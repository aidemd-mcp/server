import { describe, it, expect } from "vitest";
import type { ObserverEvent } from "@/types/index.js";
import findOpenPhase from "./index.js";

const PROJECT_ROOT = process.platform === "win32" ? "C:\\proj" : "/proj";

function makeEvent(seq: number, kind: ObserverEvent["kind"], fields: Record<string, unknown> = {}): ObserverEvent {
	return { v: 2, ts: "2026-11-22T12:00:00.000Z", sessionId: "s1", seq, pid: 100, kind, ...fields } as ObserverEvent;
}

function started(seq: number, phase: string, module: string, pipeline?: string) {
	return makeEvent(seq, "phase_started", { phase, agent: `agent-${phase}`, module, ...(pipeline ? { pipeline } : {}) });
}
function finished(seq: number, phase: string, module: string, pipeline?: string) {
	return makeEvent(seq, "phase_finished", { phase, agent: `agent-${phase}`, module, ...(pipeline ? { pipeline } : {}) });
}
const commit = (seq: number) => makeEvent(seq, "commit", { sha: "abc1234" });
const pipelineFinished = (seq: number, pipeline: string) =>
	makeEvent(seq, "pipeline_finished", { pipeline, result: "completed" });

function open(events: ObserverEvent[], pipeline: string | null) {
	return findOpenPhase({ projectRoot: PROJECT_ROOT, events, pipeline })?.seq ?? null;
}

describe("findOpenPhase", () => {
	it("returns the newest phase_started when nothing closes it", () => {
		expect(open([started(1, "spec", "src/x", "p"), finished(2, "spec", "src/x", "p"), started(3, "plan", "src/x", "p")], "p")).toBe(3);
	});

	it.each([
		["a phase_finished of the same phase and module", [started(1, "build", "src/x", "p"), finished(2, "build", "src/x", "p")]],
		[
			"a phase_finished whose module is written as an absolute path",
			[started(1, "build", "src/x", "p"), finished(2, "build", `${PROJECT_ROOT}/src/x`, "p")],
		],
		["a commit", [started(1, "build", "src/x", "p"), commit(2)]],
		["a pipeline_finished of that pipeline", [started(1, "build", "src/x", "p"), pipelineFinished(2, "p")]],
	])("is closed by %s", (_name, events) => {
		expect(open(events, "p")).toBeNull();
	});

	it.each([
		["a phase_finished of another phase", [started(1, "build", "src/x", "p"), finished(2, "qa", "src/x", "p")]],
		["a phase_finished of another module", [started(1, "build", "src/x", "p"), finished(2, "build", "src/y", "p")]],
		["a phase_finished of another pipeline", [started(1, "build", "src/x", "p"), finished(2, "build", "src/x", "q")]],
		["a phase_started of another pipeline", [started(1, "build", "src/x", "p"), started(2, "qa", "src/x", "q")]],
		["a pipeline_finished of another pipeline", [started(1, "build", "src/x", "p"), pipelineFinished(2, "q")]],
		["a v1 phase_started with no pipeline", [started(1, "build", "src/x", "p"), started(2, "qa", "src/x")]],
	])("stays open past %s", (_name, events) => {
		expect(open(events, "p")).toBe(1);
	});

	it("hands the open slot to the next phase_started in scope", () => {
		expect(open([started(1, "build", "src/x", "p"), started(2, "qa", "src/x", "p")], "p")).toBe(2);
	});

	it("sorts by seq before deciding", () => {
		expect(open([finished(2, "build", "src/x", "p"), started(1, "build", "src/x", "p")], "p")).toBeNull();
	});

	it("reads a v1 phase in the null scope and ignores pipeline phases there", () => {
		expect(open([started(1, "build", "src/x"), started(2, "qa", "src/x", "p")], null)).toBe(1);
		expect(open([started(1, "build", "src/x"), finished(2, "build", "src/x")], null)).toBeNull();
		expect(open([started(1, "build", "src/x"), commit(2)], null)).toBeNull();
	});

	it("returns null when the scope holds no phase_started", () => {
		expect(open([started(1, "build", "src/x", "q")], "p")).toBeNull();
		expect(open([], null)).toBeNull();
	});
});
