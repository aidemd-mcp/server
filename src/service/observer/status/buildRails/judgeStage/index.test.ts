import { describe, it, expect } from "vitest";
import type { ObserverEvent } from "@/types/index.js";
import judgeStage from "./index.js";

let counter = 0;

function makeEvent(kind: ObserverEvent["kind"], fields: Record<string, unknown> = {}): ObserverEvent {
	counter += 1;
	return { v: 2, ts: "2026-11-22T12:00:00.000Z", sessionId: "s1", seq: counter, pid: 1, pipeline: "p1", kind, ...fields } as ObserverEvent;
}

const started = (phase: string) => makeEvent("phase_started", { phase, agent: "a", module: "src/a" });
const finished = (phase: string) => makeEvent("phase_finished", { phase, agent: "a", module: "src/a" });
const skipped = (phase: string, reason = "no research needed") => makeEvent("phase_skipped", { phase, reason });

describe("judgeStage", () => {
	it("is pending with no events", () => {
		expect(judgeStage({ phase: "spec", pipelineEvents: [] })).toEqual({ state: "pending" });
	});

	it("is done from a phase_finished", () => {
		expect(judgeStage({ phase: "spec", pipelineEvents: [started("spec"), finished("spec")] })).toEqual({ state: "done" });
	});

	it("is done from a phase_finished alone", () => {
		expect(judgeStage({ phase: "spec", pipelineEvents: [finished("spec")] })).toEqual({ state: "done" });
	});

	it("is skipped with its reason from a skip report", () => {
		expect(judgeStage({ phase: "research", pipelineEvents: [skipped("research", "known domain")] })).toEqual({
			state: "skipped",
			reason: "known domain",
		});
	});

	it("is pending, never skipped, for a gap with no skip report", () => {
		const pipelineEvents = [finished("spec"), started("plan")];

		expect(judgeStage({ phase: "research", pipelineEvents })).toEqual({ state: "pending" });
	});

	it("goes back to started work when the skipped phase restarts and closes", () => {
		const pipelineEvents = [skipped("qa"), started("qa"), started("fix")];

		expect(judgeStage({ phase: "qa", pipelineEvents })).toEqual({ state: "done" });
	});

	it("stays skipped when the skip report is newer than a start", () => {
		const pipelineEvents = [started("qa"), skipped("qa")];

		expect(judgeStage({ phase: "qa", pipelineEvents }).state).toBe("skipped");
	});

	it.each([
		["another phase starting", () => started("qa")],
		["a gate resolving", () => makeEvent("gate_resolved", { gate: "plan approval", file: "src/a/plan.aide" })],
		["a commit", () => makeEvent("commit", { sha: "abcdef1" })],
		["the pipeline finishing", () => makeEvent("pipeline_finished", { result: "completed" })],
	])("is done when a start is closed by %s (missed finish)", (_label, makeCloser) => {
		const pipelineEvents = [started("build"), makeCloser()];

		expect(judgeStage({ phase: "build", pipelineEvents })).toEqual({ state: "done" });
	});

	it("is pending, not done, for a start with nothing after it", () => {
		expect(judgeStage({ phase: "build", pipelineEvents: [started("build")] })).toEqual({ state: "pending" });
	});

	it("is not closed by a restart of the same phase", () => {
		expect(judgeStage({ phase: "build", pipelineEvents: [started("build"), started("build")] })).toEqual({
			state: "pending",
		});
	});

	it("is not done from a closing event that came before the start", () => {
		const pipelineEvents = [makeEvent("commit", { sha: "abcdef1" }), started("build")];

		expect(judgeStage({ phase: "build", pipelineEvents }).state).toBe("pending");
	});
});
