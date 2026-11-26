import { describe, expect, it } from "vitest";
import type { ObserverEvent } from "@/types/index.js";
import type { HeldSession } from "../../types/index.js";
import pickReportedLocation from "./index.js";

function makeStarted({
	sessionId,
	ts,
	brainPath,
	kanbanTag,
}: {
	sessionId: string;
	ts: string;
	brainPath?: string;
	kanbanTag?: string;
}): ObserverEvent {
	return {
		v: 1,
		ts,
		sessionId,
		seq: 1,
		pid: 4242,
		kind: "session_started",
		...(brainPath !== undefined ? { brainPath } : {}),
		...(kanbanTag !== undefined ? { kanbanTag } : {}),
	};
}

function makeSession({ sessionId, events }: { sessionId: string; events: ObserverEvent[] }): HeldSession {
	return { projectKey: "p-aaaaaa", sessionId, events };
}

describe("pickReportedLocation", () => {
	it("takes the newest session_started over older sessions", () => {
		const sessions = [
			makeSession({
				sessionId: "old",
				events: [makeStarted({ sessionId: "old", ts: "2026-01-01T00:00:00.000Z", brainPath: "/old", kanbanTag: "old-tag" })],
			}),
			makeSession({
				sessionId: "new",
				events: [makeStarted({ sessionId: "new", ts: "2026-02-01T00:00:00.000Z", brainPath: "/new", kanbanTag: "new-tag" })],
			}),
		];

		expect(pickReportedLocation({ sessions })).toEqual({ kanbanTag: "new-tag" });
	});

	it("never fills a missing kanbanTag from an older session", () => {
		const sessions = [
			makeSession({
				sessionId: "old",
				events: [makeStarted({ sessionId: "old", ts: "2026-01-01T00:00:00.000Z", brainPath: "/old", kanbanTag: "old-tag" })],
			}),
			makeSession({
				sessionId: "new",
				events: [makeStarted({ sessionId: "new", ts: "2026-02-01T00:00:00.000Z", brainPath: "/new" })],
			}),
		];

		const result = pickReportedLocation({ sessions });

		expect(result).toEqual({});
		expect(result).not.toHaveProperty("kanbanTag");
	});

	it("returns an empty location when the newest session_started reported nothing", () => {
		const sessions = [makeSession({ sessionId: "a", events: [makeStarted({ sessionId: "a", ts: "2026-01-01T00:00:00.000Z" })] })];

		expect(pickReportedLocation({ sessions })).toEqual({});
	});

	it("returns null with no sessions or no session_started", () => {
		const prompt: ObserverEvent = { v: 1, ts: "2026-01-01T00:00:00.000Z", sessionId: "a", seq: 1, pid: 1, kind: "prompt", text: "hi" };

		expect(pickReportedLocation({ sessions: [] })).toBeNull();
		expect(pickReportedLocation({ sessions: [makeSession({ sessionId: "a", events: [prompt] })] })).toBeNull();
	});
});
