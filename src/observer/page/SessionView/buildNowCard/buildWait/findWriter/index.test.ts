import { describe, expect, it } from "vitest";
import type { ObserverEvent, WaitingFile } from "@/types/index.js";
import findWriter from "./index.js";

const waiting: WaitingFile = { file: "src/a/plan.aide", folder: "src/a", kind: "plan", gate: "g", sessionId: "s1", seq: 10, since: "2026-01-01T09:55:00.000Z" };

function finished({ seq, agent, module = "src/a", sessionId = "s1" }: { seq: number; agent: string; module?: string; sessionId?: string }): ObserverEvent {
	return { v: 1, ts: "2026-01-01T09:00:00.000Z", sessionId, pid: 1, seq, kind: "phase_finished", phase: "plan", agent, module } as ObserverEvent;
}

describe("findWriter", () => {
	it("is the agent of the newest earlier finish in the waiting session for the module", () => {
		const events = [finished({ seq: 2, agent: "first" }), finished({ seq: 6, agent: "aide-architect", module: "/work/app/src/a" })];
		expect(findWriter({ projectRoot: "/work/app", events, waiting })).toBe("aide-architect");
	});

	it("ignores finishes after the gate, in other sessions or for other modules", () => {
		const events = [finished({ seq: 11, agent: "after" }), finished({ seq: 3, agent: "other", sessionId: "s2" }), finished({ seq: 4, agent: "elsewhere", module: "src/b" })];
		expect(findWriter({ projectRoot: "/work/app", events, waiting })).toBeNull();
	});
});
