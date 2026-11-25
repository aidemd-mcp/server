import { describe, it, expect } from "vitest";
import SESSION_QUIET_LIMIT_MS from "@/util/sessionQuietLimit/index.js";
import judgeLiveness from "@/service/observer/event/shared/judgeLiveness/index.js";
import type { EndedMark } from "@/service/observer/event/shared/endedMark/index.js";
import type { Presence } from "@/service/observer/event/shared/presenceRecord/index.js";
import type { ObserverEvent } from "@/service/observer/event/shared/schema/index.js";

const NOW = Date.parse("2026-11-25T12:00:00.000Z");
const MINUTE = 60 * 1000;

function msBefore(ms: number): string {
	return new Date(NOW - ms).toISOString();
}

function makeEvent(overrides: Partial<ObserverEvent> = {}): ObserverEvent {
	return {
		v: 2,
		ts: msBefore(0),
		sessionId: "20261125T090000000Z-aaaaaa",
		seq: 1,
		pid: 4242,
		kind: "release",
		version: "1.0.0",
		...overrides,
	} as ObserverEvent;
}

function makePresence(overrides: Partial<Presence> = {}): Presence {
	return {
		v: 1,
		claudeSessionId: "claude-aaaa",
		state: "working",
		at: msBefore(0),
		hookEvent: "PostToolUse",
		...overrides,
	};
}

function makeMark(overrides: Partial<EndedMark> = {}): EndedMark {
	return {
		v: 1,
		sessionId: "20261125T090000000Z-aaaaaa",
		endedAt: msBefore(MINUTE),
		endedBy: "user",
		...overrides,
	};
}

const NONE = { events: [], presence: null, endedMark: null, transcriptActivityAt: null, now: NOW };

describe("judgeLiveness: state", () => {
	it.each([
		{
			name: "an ended mark wins over a working presence",
			input: { ...NONE, presence: makePresence({ state: "working" }), endedMark: makeMark({ endedBy: "user" }) },
			expected: { state: "ended", endedBy: "user" },
		},
		{
			name: "an ended mark written by the hook reports hook",
			input: { ...NONE, endedMark: makeMark({ endedBy: "hook" }) },
			expected: { state: "ended", endedBy: "hook" },
		},
		{
			name: "a SessionEnd presence is ended by the hook",
			input: { ...NONE, presence: makePresence({ state: "ended", hookEvent: "SessionEnd" }) },
			expected: { state: "ended", endedBy: "hook" },
		},
		{
			name: "a Stop presence is waiting",
			input: { ...NONE, presence: makePresence({ state: "waiting", hookEvent: "Stop" }) },
			expected: { state: "waiting", endedBy: undefined },
		},
		{
			name: "a working presence is working",
			input: { ...NONE, presence: makePresence({ state: "working" }) },
			expected: { state: "working", endedBy: undefined },
		},
		{
			name: "a v2 session with no presence is working",
			input: { ...NONE, events: [makeEvent({ v: 2 } as Partial<ObserverEvent>)] },
			expected: { state: "working", endedBy: undefined },
		},
		{
			name: "a v1 session with no presence is working too, no legacy state",
			input: { ...NONE, events: [makeEvent({ v: 1 } as Partial<ObserverEvent>)] },
			expected: { state: "working", endedBy: undefined },
		},
		{
			name: "no events and no presence is working",
			input: NONE,
			expected: { state: "working", endedBy: undefined },
		},
	])("$name", ({ input, expected }) => {
		const liveness = judgeLiveness(input);

		expect(liveness.state).toBe(expected.state);
		expect(liveness.endedBy).toBe(expected.endedBy);
	});

	it("omits endedBy from a session that is not ended", () => {
		expect("endedBy" in judgeLiveness(NONE)).toBe(false);
	});
});

describe("judgeLiveness: quiet and maybe stuck", () => {
	it.each([
		{ name: "a v2 session", v: 2 },
		{ name: "a v1 session", v: 1 },
	])("$name with no presence is working forever and maybe stuck after 15 minutes", ({ v }) => {
		const events = [makeEvent({ v, ts: msBefore(SESSION_QUIET_LIMIT_MS + MINUTE) } as Partial<ObserverEvent>)];

		const liveness = judgeLiveness({ ...NONE, events });

		expect(liveness.state).toBe("working");
		expect(liveness.maybeStuck).toBe(true);
		expect(liveness.quietMinutes).toBe(16);
	});

	it("is not maybe stuck at exactly the quiet limit, and is just past it", () => {
		const atLimit = judgeLiveness({ ...NONE, events: [makeEvent({ ts: msBefore(SESSION_QUIET_LIMIT_MS) })] });
		const pastLimit = judgeLiveness({ ...NONE, events: [makeEvent({ ts: msBefore(SESSION_QUIET_LIMIT_MS + 1) })] });

		expect(atLimit.maybeStuck).toBe(false);
		expect(pastLimit.maybeStuck).toBe(true);
	});

	it("is never maybe stuck once ended, however old", () => {
		const liveness = judgeLiveness({ ...NONE, endedMark: makeMark(), events: [makeEvent({ ts: msBefore(5 * 60 * MINUTE) })] });

		expect(liveness.state).toBe("ended");
		expect(liveness.maybeStuck).toBe(false);
		expect(liveness.quietMinutes).toBe(300);
	});

	it("a waiting presence goes maybe stuck by the same limit", () => {
		const liveness = judgeLiveness({
			...NONE,
			presence: makePresence({ state: "waiting", at: msBefore(20 * MINUTE) }),
		});

		expect(liveness.state).toBe("waiting");
		expect(liveness.maybeStuck).toBe(true);
	});

	it("floors quiet minutes", () => {
		const liveness = judgeLiveness({ ...NONE, events: [makeEvent({ ts: msBefore(2 * MINUTE + 59_999) })] });

		expect(liveness.quietMinutes).toBe(2);
	});

	it("reads no quiet time from the future", () => {
		const liveness = judgeLiveness({ ...NONE, events: [makeEvent({ ts: msBefore(-5 * MINUTE) })] });

		expect(liveness.quietMinutes).toBe(0);
		expect(liveness.maybeStuck).toBe(false);
	});

	it("has no last activity and 0 quiet minutes when there is no source at all", () => {
		const liveness = judgeLiveness(NONE);

		expect(liveness.lastActivityAt).toBeNull();
		expect(liveness.quietMinutes).toBe(0);
		expect(liveness.maybeStuck).toBe(false);
	});
});

describe("judgeLiveness: last activity", () => {
	const presenceAt = msBefore(10 * MINUTE);
	const transcriptAt = msBefore(4 * MINUTE);
	const eventAt = msBefore(7 * MINUTE);

	it.each([
		{ name: "the transcript write", presence: presenceAt, transcript: transcriptAt, event: eventAt, expected: transcriptAt },
		{ name: "the event time", presence: presenceAt, transcript: msBefore(30 * MINUTE), event: msBefore(2 * MINUTE), expected: msBefore(2 * MINUTE) },
		{ name: "the presence time", presence: msBefore(MINUTE), transcript: transcriptAt, event: eventAt, expected: msBefore(MINUTE) },
	])("picks $name when it is the newest of the three", ({ presence, transcript, event, expected }) => {
		const liveness = judgeLiveness({
			events: [makeEvent({ ts: event })],
			presence: makePresence({ at: presence }),
			endedMark: null,
			transcriptActivityAt: transcript,
			now: NOW,
		});

		expect(liveness.lastActivityAt).toBe(expected);
	});

	it("takes the newest event, wherever it sits in the array", () => {
		const liveness = judgeLiveness({
			...NONE,
			events: [makeEvent({ seq: 2, ts: msBefore(MINUTE) }), makeEvent({ seq: 1, ts: msBefore(9 * MINUTE) })],
		});

		expect(liveness.lastActivityAt).toBe(msBefore(MINUTE));
	});

	it("uses only the sources that exist", () => {
		const liveness = judgeLiveness({ ...NONE, transcriptActivityAt: transcriptAt });

		expect(liveness.lastActivityAt).toBe(transcriptAt);
		expect(liveness.quietMinutes).toBe(4);
	});
});
