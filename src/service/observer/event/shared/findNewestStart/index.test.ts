import { describe, it, expect } from "vitest";
import findNewestStart from "@/service/observer/event/shared/findNewestStart/index.js";
import type { ObserverEvent } from "@/service/observer/event/shared/schema/index.js";

function makeStart(ts: string, overrides: Record<string, unknown> = {}): ObserverEvent {
	return {
		v: 1,
		ts,
		sessionId: "20261122T090000000Z-aaaaaa",
		seq: 1,
		pid: 4242,
		kind: "session_started",
		...overrides,
	} as ObserverEvent;
}

function makeRelease(ts: string): ObserverEvent {
	return {
		v: 1,
		ts,
		sessionId: "20261122T090000000Z-aaaaaa",
		seq: 2,
		pid: 4242,
		kind: "release",
		version: "1.0.0",
	} as ObserverEvent;
}

describe("findNewestStart", () => {
	it("returns the session_started with the latest ts of three sessions", () => {
		const middle = makeStart("2026-11-22T10:00:00.000Z", { projectRoot: "/b" });
		const newest = makeStart("2026-11-22T11:00:00.000Z", { projectRoot: "/c" });
		const oldest = makeStart("2026-11-22T09:00:00.000Z", { projectRoot: "/a" });

		const found = findNewestStart({
			sessions: [{ events: [middle] }, { events: [newest] }, { events: [oldest] }],
		});

		expect(found).toBe(newest);
	});

	it("is not hidden by a newer session that has no session_started", () => {
		const start = makeStart("2026-11-22T09:00:00.000Z", { projectRoot: "/a" });

		const found = findNewestStart({
			sessions: [{ events: [start] }, { events: [makeRelease("2026-11-22T12:00:00.000Z")] }],
		});

		expect(found).toBe(start);
	});

	it("returns null when no session has a session_started", () => {
		expect(findNewestStart({ sessions: [{ events: [makeRelease("2026-11-22T09:00:00.000Z")] }, { events: [] }] })).toBeNull();
		expect(findNewestStart({ sessions: [] })).toBeNull();
	});

	it("returns the recorded object with absent fields still absent", () => {
		const older = makeStart("2026-11-22T09:00:00.000Z", { projectRoot: "/old", kanbanTag: "old-tag", brainPath: "/brain" });
		const newer = makeStart("2026-11-22T10:00:00.000Z", { kanbanTag: "new-tag" });

		const found = findNewestStart({ sessions: [{ events: [older] }, { events: [newer] }] });

		expect(found).toBe(newer);
		expect(found).not.toHaveProperty("projectRoot");
		expect(found).not.toHaveProperty("brainPath");
	});
});
