import { describe, expect, it } from "vitest";
import type { ObserverEvent } from "@/types/index.js";
import type { SessionRowModel } from "@/observer/page/types/index.js";
import pickSessionIds from "./index.js";
import makeLiveness from "@/observer/page/__fixtures__/makeLiveness/index.js";

function session({ sessionId, liveness }: { sessionId: string; liveness: SessionRowModel["liveness"] }): SessionRowModel {
	return { sessionId, startedAt: "2026-01-01T09:00:00.000Z", lastEventAt: null, eventCount: 1, liveness, task: null, label: null };
}

function prompt(sessionId: string): ObserverEvent {
	return { v: 1, ts: "2026-01-01T09:00:00.000Z", sessionId, pid: 1, seq: 1, kind: "prompt", text: "go" };
}

describe("pickSessionIds", () => {
	it("is the focused session alone when the project lists it, even while others run", () => {
		const sessions = [session({ sessionId: "a", liveness: makeLiveness() }), session({ sessionId: "b", liveness: makeLiveness({ minutesQuiet: 20 }) }), session({ sessionId: "old", liveness: makeLiveness({ state: "ended" }) })];
		expect(pickSessionIds({ sessions, focus: "a", events: [] })).toEqual(["a"]);
	});

	it("is every running session when the focused one is not listed", () => {
		const sessions = [session({ sessionId: "a", liveness: makeLiveness() }), session({ sessionId: "b", liveness: makeLiveness({ minutesQuiet: 20 }) }), session({ sessionId: "old", liveness: makeLiveness({ state: "ended" }) })];
		expect(pickSessionIds({ sessions, focus: "x", events: [] })).toEqual(["a", "b"]);
	});

	it("is the focused session alone when it has ended, whatever else runs", () => {
		const sessions = [session({ sessionId: "a", liveness: makeLiveness() }), session({ sessionId: "old", liveness: makeLiveness({ state: "ended" }) })];
		expect(pickSessionIds({ sessions, focus: "old", events: [] })).toEqual(["old"]);
	});

	it("falls back to the focused session when nothing runs and it is not listed", () => {
		expect(pickSessionIds({ sessions: [session({ sessionId: "old", liveness: makeLiveness({ state: "ended" }) })], focus: "x", events: [] })).toEqual(["x"]);
	});

	it("is every session the events name when no session is listed", () => {
		expect(pickSessionIds({ sessions: [], focus: "a", events: [prompt("a"), prompt("b"), prompt("a")] })).toEqual(["a", "b"]);
	});
});
