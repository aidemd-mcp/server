import { describe, it, expect } from "vitest";
import type { ObserverEvent } from "@/types/index.js";
import buildHistory from "./index.js";

function makeEvent(
	fields: Record<string, unknown> & { kind: ObserverEvent["kind"] },
	envelope: { sessionId?: string; seq?: number; ts?: string } = {},
): ObserverEvent {
	return {
		v: 1,
		ts: "2026-11-22T10:00:00.000Z",
		sessionId: "s1",
		seq: 1,
		pid: 100,
		...envelope,
		...fields,
	} as ObserverEvent;
}

function makeRelease(seq: number, ts: string, sessionId = "s1"): ObserverEvent {
	return makeEvent({ kind: "release", version: `v${sessionId}-${seq}` }, { seq, ts, sessionId });
}

describe("buildHistory", () => {
	it("returns events given shuffled in time order", () => {
		const events = [
			makeRelease(3, "2026-11-22T10:03:00.000Z"),
			makeRelease(1, "2026-11-22T10:01:00.000Z"),
			makeRelease(2, "2026-11-22T10:02:00.000Z"),
		];

		expect(buildHistory({ events }).map((row) => row.seq)).toEqual([1, 2, 3]);
	});

	it("keeps a session's own order when its ts goes backwards", () => {
		const events = [
			makeRelease(1, "2026-11-22T10:01:00.000Z"),
			makeRelease(2, "2026-11-22T10:02:00.000Z"),
			makeRelease(3, "2026-11-22T10:05:00.000Z"),
			makeRelease(4, "2026-11-22T10:04:00.000Z"),
		];

		expect(buildHistory({ events }).map((row) => row.seq)).toEqual([1, 2, 3, 4]);
	});

	it("interleaves two sessions by time and breaks ties by sessionId ascending", () => {
		const events = [
			makeRelease(1, "2026-11-22T10:01:00.000Z", "b"),
			makeRelease(2, "2026-11-22T10:04:00.000Z", "b"),
			makeRelease(1, "2026-11-22T10:01:00.000Z", "a"),
			makeRelease(2, "2026-11-22T10:03:00.000Z", "a"),
		];

		expect(buildHistory({ events }).map((row) => `${row.sessionId}${row.seq}`)).toEqual(["a1", "b1", "a2", "b2"]);
	});

	it("adds no placeholder row for a missing seq", () => {
		const events = [makeRelease(1, "2026-11-22T10:01:00.000Z"), makeRelease(3, "2026-11-22T10:03:00.000Z")];

		const rows = buildHistory({ events });

		expect(rows).toHaveLength(events.length);
		expect(rows.map((row) => row.seq)).toEqual([1, 3]);
	});

	it("labels a prompt row with its first line and keeps the full prompt as detail", () => {
		const text = "line one\nline two";
		const rows = buildHistory({ events: [makeEvent({ kind: "prompt", text })] });

		expect(rows[0]).toMatchObject({ kind: "prompt", label: 'You: "line one…"', detail: { text } });
	});

	it("carries sessionId, seq, ts and kind on each row", () => {
		const rows = buildHistory({ events: [makeRelease(2, "2026-11-22T10:02:00.000Z", "zz")] });

		expect(rows[0]).toEqual({
			sessionId: "zz",
			seq: 2,
			ts: "2026-11-22T10:02:00.000Z",
			kind: "release",
			label: "Released vzz-2",
		});
	});

	it("takes a finished phase's duration from the latest earlier start of the same phase and module", () => {
		const events = [
			makeEvent(
				{ kind: "phase_started", phase: "qa", agent: "aide-qa", module: "src/a" },
				{ seq: 1, ts: "2026-11-22T10:00:00.000Z" },
			),
			makeEvent(
				{ kind: "phase_started", phase: "qa", agent: "aide-qa", module: "src/b" },
				{ seq: 2, ts: "2026-11-22T10:01:00.000Z" },
			),
			makeEvent(
				{ kind: "phase_finished", phase: "qa", agent: "aide-qa", module: "src/a" },
				{ seq: 3, ts: "2026-11-22T10:04:12.000Z" },
			),
		];

		expect(buildHistory({ events })[2]?.label).toBe("QA done · 4m 12s");
	});

	it("does not borrow a start from another session", () => {
		const events = [
			makeEvent(
				{ kind: "phase_started", phase: "qa", agent: "aide-qa", module: "src/a" },
				{ sessionId: "other", seq: 1, ts: "2026-11-22T09:00:00.000Z" },
			),
			makeEvent(
				{ kind: "phase_finished", phase: "qa", agent: "aide-qa", module: "src/a" },
				{ sessionId: "s1", seq: 1, ts: "2026-11-22T10:00:00.000Z" },
			),
		];

		const rows = buildHistory({ events });

		expect(rows.find((row) => row.sessionId === "s1")?.label).toBe("QA done");
	});

	it("returns no rows for no events", () => {
		expect(buildHistory({ events: [] })).toEqual([]);
	});
});
