import { describe, expect, it } from "vitest";
import type { ObserverEvent, SessionLiveness } from "@/types/index.js";
import summarizeSessions from "./index.js";

function makeLiveness(overrides: Partial<SessionLiveness> = {}): SessionLiveness {
	return { state: "working", lastActivityAt: "2026-01-01T00:00:02.000Z", quietMinutes: 0, maybeStuck: false, ...overrides };
}

function makeStarted(seq: number, extra: Record<string, string> = {}): ObserverEvent {
	return {
		v: 2,
		ts: `2026-01-01T00:00:0${seq}.000Z`,
		sessionId: "a",
		seq,
		pid: 1,
		kind: "session_started",
		...extra,
	} as ObserverEvent;
}

function makePrompt(seq: number): ObserverEvent {
	return { v: 2, ts: `2026-01-01T00:00:0${seq}.000Z`, sessionId: "a", seq, pid: 1, kind: "prompt", text: "x" };
}

describe("summarizeSessions", () => {
	it("summarizes a session with its session_started metadata and the liveness handed in, unchanged", () => {
		const events = [makeStarted(1, { projectRoot: "/p", kanbanTag: "t" }), makePrompt(2)];
		const liveness = makeLiveness({ state: "waiting", quietMinutes: 3 });

		expect(
			summarizeSessions({ sessions: [{ projectKey: "p-aaaaaa", sessionId: "a", events }], liveness: { a: liveness } }),
		).toEqual([
			{
				sessionId: "a",
				startedAt: events[0]!.ts,
				metadata: { projectRoot: "/p", kanbanTag: "t" },
				eventCount: 2,
				lastEventAt: events[1]!.ts,
				liveness,
			},
		]);
	});

	it("copies an ended liveness with its endedBy", () => {
		const liveness = makeLiveness({ state: "ended", endedBy: "user" });

		const [listing] = summarizeSessions({
			sessions: [{ projectKey: "p-aaaaaa", sessionId: "a", events: [makeStarted(1)] }],
			liveness: { a: liveness },
		});

		expect(listing!.liveness).toEqual({ ...liveness, endedBy: "user" });
	});

	it("falls back to the first event's ts and no metadata without a session_started", () => {
		const events = [makePrompt(3), makePrompt(4)];

		const [listing] = summarizeSessions({
			sessions: [{ projectKey: "p-aaaaaa", sessionId: "a", events }],
			liveness: { a: makeLiveness() },
		});

		expect(listing).toMatchObject({ startedAt: events[0]!.ts, metadata: null });
	});

	it("gives null times for a session with no events", () => {
		const liveness = makeLiveness({ lastActivityAt: null });

		expect(
			summarizeSessions({ sessions: [{ projectKey: "p-aaaaaa", sessionId: "a", events: [] }], liveness: { a: liveness } }),
		).toEqual([{ sessionId: "a", startedAt: null, metadata: null, eventCount: 0, lastEventAt: null, liveness }]);
	});

	it("gives empty metadata when session_started carries no fields", () => {
		const [listing] = summarizeSessions({
			sessions: [{ projectKey: "p-aaaaaa", sessionId: "a", events: [makeStarted(1)] }],
			liveness: { a: makeLiveness() },
		});

		expect(listing!.metadata).toEqual({});
	});

	it("throws for a session whose liveness was not read, never judging it itself", () => {
		expect(() =>
			summarizeSessions({ sessions: [{ projectKey: "p-aaaaaa", sessionId: "a", events: [makeStarted(1)] }], liveness: {} }),
		).toThrow("No liveness was read for session a.");
	});
});
