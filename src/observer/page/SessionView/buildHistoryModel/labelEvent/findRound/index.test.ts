import { describe, expect, it } from "vitest";
import type { ObserverEvent } from "@/types/index.js";
import findRound from "./index.js";

function verdict({ seq, module, sessionId = "s1" }: { seq: number; module: string; sessionId?: string }): ObserverEvent {
	return { v: 1, ts: "2026-01-01T09:00:00.000Z", sessionId, pid: 1, seq, kind: "qa_verdict", module, verdict: "issues" };
}

const EVENTS = [verdict({ seq: 2, module: "a" }), verdict({ seq: 4, module: "b" }), verdict({ seq: 6, module: "a" }), verdict({ seq: 3, module: "a", sessionId: "s2" })];
const sameA = (module: string): boolean => module === "a";

describe("findRound", () => {
	it("counts the session's verdicts for the module before `seq` when exclusive", () => {
		expect(findRound({ events: EVENTS, sessionId: "s1", seq: 6, inclusive: false, sameModule: sameA })).toBe(1);
		expect(findRound({ events: EVENTS, sessionId: "s1", seq: 2, inclusive: false, sameModule: sameA })).toBe(0);
	});

	it("counts the verdict at `seq` itself when inclusive, and no other session's or module's", () => {
		expect(findRound({ events: EVENTS, sessionId: "s1", seq: 6, inclusive: true, sameModule: sameA })).toBe(2);
		expect(findRound({ events: EVENTS, sessionId: "s2", seq: 3, inclusive: true, sameModule: sameA })).toBe(1);
	});
});
