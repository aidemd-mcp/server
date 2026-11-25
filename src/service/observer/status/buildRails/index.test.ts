import { describe, it, expect } from "vitest";
import type { ObserverEvent, SessionLiveness } from "@/types/index.js";
import type { PipelineRail, RunningWork, SessionSummary } from "../types/index.js";
import buildRails from "./index.js";

const BASE = Date.parse("2026-11-22T12:00:00.000Z");
const MINUTE = 60 * 1000;

function at(minutes: number): string {
	return new Date(BASE + minutes * MINUTE).toISOString();
}

function makeEvent(
	kind: ObserverEvent["kind"],
	fields: Record<string, unknown>,
	envelope: { sessionId?: string; seq: number; ts?: string },
): ObserverEvent {
	return { v: 2, ts: at(envelope.seq), sessionId: "s1", pid: 1, kind, ...fields, ...envelope } as ObserverEvent;
}

function makeSession(sessionId: string, state: SessionLiveness["state"] = "working"): SessionSummary {
	return {
		sessionId,
		startedAt: at(0),
		lastEventAt: at(0),
		eventCount: 1,
		pid: 1,
		liveness: { state, lastActivityAt: at(0), quietMinutes: 0, maybeStuck: false },
		reported: null,
	};
}

function makeRunning(overrides: Partial<RunningWork> = {}): RunningWork {
	return {
		sessionId: "s1",
		phase: "build",
		agent: "aide-implementor",
		module: "src/a",
		startedAt: at(10),
		elapsedMs: 0,
		...overrides,
	};
}

const pipelineStarted = (pipeline: string, seq: number, envelope: { sessionId?: string } = {}) =>
	makeEvent("pipeline_started", { pipeline, phase: "spec" }, { seq, ...envelope });
const pipelineFinished = (pipeline: string, seq: number) =>
	makeEvent("pipeline_finished", { pipeline, result: "completed" }, { seq });
const phaseStarted = (pipeline: string | undefined, phase: string, seq: number, envelope: { sessionId?: string } = {}) =>
	makeEvent("phase_started", { phase, agent: "a", module: "src/a", ...(pipeline ? { pipeline } : {}) }, { seq, ...envelope });
const phaseFinished = (pipeline: string | undefined, phase: string, seq: number, envelope: { sessionId?: string } = {}) =>
	makeEvent("phase_finished", { phase, agent: "a", module: "src/a", ...(pipeline ? { pipeline } : {}) }, { seq, ...envelope });

function build({
	events,
	archivedEvents = [],
	sessions = [makeSession("s1")],
	running = [],
}: {
	events: ObserverEvent[];
	archivedEvents?: ObserverEvent[];
	sessions?: SessionSummary[];
	running?: RunningWork[];
}): PipelineRail[] {
	return buildRails({ events, archivedEvents, sessions, running });
}

function states(rail: PipelineRail | undefined): Record<string, string | undefined> {
	return Object.fromEntries((rail?.stages ?? []).map((stage) => [stage.phase, stage.state]));
}

describe("buildRails — stages", () => {
	it("lists every phase of the closed list once, in order, with labels", () => {
		const [rail] = build({ events: [pipelineStarted("p1", 1)] });

		expect(rail.stages.map((stage) => stage.phase)).toEqual([
			"spec", "research", "synthesize", "structure", "plan", "build", "qa", "fix", "align", "refactor", "cleanup",
		]);
		expect(rail.stages[0]?.label).toBe("Spec");
	});

	it("resumes a pipeline: Spec to Plan done from an archived session, Build running here, QA and Fix pending", () => {
		const archivedEvents = [
			pipelineStarted("p1", 1, { sessionId: "old" }),
			phaseFinished("p1", "spec", 2, { sessionId: "old" }),
			phaseFinished("p1", "plan", 3, { sessionId: "old" }),
		];
		const events = [pipelineStarted("p1", 10), phaseStarted("p1", "build", 11)];
		const running = [makeRunning({ buildStep: { reached: 2, total: 5 } })];

		const [rail] = build({ events, archivedEvents, running });

		expect(rail.pipeline).toBe("p1");
		expect(rail.pipelineState).toBe("running");
		expect(states(rail)).toMatchObject({ spec: "done", plan: "done", build: "running", qa: "pending", fix: "pending" });
		expect(rail.stages.find((stage) => stage.phase === "build")?.buildStep).toEqual({ reached: 2, total: 5 });
	});

	it("carries the QA round on the running stage", () => {
		const events = [pipelineStarted("p1", 1), phaseStarted("p1", "qa", 2)];

		const [rail] = build({ events, running: [makeRunning({ phase: "qa", qaFixRound: 2 })] });

		expect(rail.stages.find((stage) => stage.phase === "qa")).toMatchObject({ state: "running", qaFixRound: 2 });
	});

	it("marks Build done when QA started and the finish was missed", () => {
		const events = [pipelineStarted("p1", 1), phaseStarted("p1", "build", 2), phaseStarted("p1", "qa", 3)];

		const [rail] = build({ events, running: [makeRunning({ phase: "qa" })] });

		expect(states(rail)).toMatchObject({ build: "done", qa: "running" });
	});

	it("marks a stage skipped, with its reason, only from a skip report", () => {
		const events = [
			pipelineStarted("p1", 1),
			makeEvent("phase_skipped", { pipeline: "p1", phase: "research", reason: "domain known" }, { seq: 2 }),
			phaseFinished("p1", "synthesize", 3),
		];

		const [rail] = build({ events });

		expect(rail.stages.find((stage) => stage.phase === "research")).toMatchObject({ state: "skipped", reason: "domain known" });
		expect(rail.stages.find((stage) => stage.phase === "structure")).toEqual({ phase: "structure", label: "Structure", state: "pending" });
	});

	it("leaves a gap pending when no skip was reported", () => {
		const events = [pipelineStarted("p1", 1), phaseFinished("p1", "spec", 2), phaseFinished("p1", "plan", 3)];

		const [rail] = build({ events });

		expect(states(rail)).toMatchObject({ spec: "done", research: "pending", synthesize: "pending", plan: "done" });
	});

	it("shows a later restart of a skipped phase as running", () => {
		const events = [
			pipelineStarted("p1", 1),
			makeEvent("phase_skipped", { pipeline: "p1", phase: "qa", reason: "later" }, { seq: 2 }),
			phaseStarted("p1", "qa", 3),
		];

		const [rail] = build({ events, running: [makeRunning({ phase: "qa" })] });

		expect(rail.stages.find((stage) => stage.phase === "qa")?.state).toBe("running");
		expect(rail.stages.find((stage) => stage.phase === "qa")).not.toHaveProperty("reason");
	});

	it("never counts another pipeline's events", () => {
		const events = [phaseFinished("p0", "spec", 1), pipelineStarted("p1", 2)];
		const archivedEvents = [phaseFinished("p9", "plan", 1, { sessionId: "old" })];

		const [rail] = build({ events, archivedEvents });

		expect(states(rail)).toMatchObject({ spec: "pending", plan: "pending" });
	});
});

describe("buildRails — pipeline state and sessions", () => {
	it("keeps a finished pipeline with all its stages until the next one starts", () => {
		const finishedEvents = [pipelineStarted("p1", 1), phaseFinished("p1", "spec", 2), pipelineFinished("p1", 3)];

		const [finishedRail] = build({ events: finishedEvents });
		const [nextRail] = build({ events: [...finishedEvents, pipelineStarted("p2", 4)] });

		expect(finishedRail.pipeline).toBe("p1");
		expect(finishedRail.pipelineState).toBe("finished");
		expect(states(finishedRail).spec).toBe("done");
		expect(nextRail.pipeline).toBe("p2");
		expect(nextRail.pipelineState).toBe("running");
		expect(states(nextRail).spec).toBe("pending");
	});

	it("gives an ended session no rail", () => {
		const events = [pipelineStarted("p1", 1)];

		expect(build({ events, sessions: [makeSession("s1", "ended")] })).toEqual([]);
	});

	it("builds one rail per live session in the order of sessions", () => {
		const events = [
			pipelineStarted("p1", 1, { sessionId: "b" }),
			pipelineStarted("p2", 1, { sessionId: "a" }),
			pipelineStarted("p3", 1, { sessionId: "c" }),
		];
		const sessions = [makeSession("b"), makeSession("c", "ended"), makeSession("a", "waiting")];

		const rails = build({ events, sessions });

		expect(rails.map((rail) => [rail.sessionId, rail.pipeline])).toEqual([
			["b", "p1"],
			["a", "p2"],
		]);
	});

	it("builds no rail for a session missing from the sessions list", () => {
		const events = [pipelineStarted("p1", 1, { sessionId: "ghost" })];

		expect(build({ events, sessions: [] })).toEqual([]);
	});

	it("reads another live session's events of the same pipeline", () => {
		const events = [
			phaseFinished("p1", "spec", 1, { sessionId: "other" }),
			pipelineStarted("p1", 2),
		];

		const [rail] = build({ events, sessions: [makeSession("s1")] });

		expect(states(rail).spec).toBe("done");
	});

	it("gives a v1 session a null pipeline built from its own pipeline-less phase events", () => {
		const events = [phaseFinished(undefined, "spec", 1), phaseStarted(undefined, "plan", 2)];

		const [rail] = build({ events, running: [makeRunning({ phase: "plan" })] });

		expect(rail.pipeline).toBeNull();
		expect(rail.pipelineState).toBe("none");
		expect(states(rail)).toMatchObject({ spec: "done", plan: "running", build: "pending" });
	});
});

describe("buildRails — outside the pipeline", () => {
	it("is outside for hand work: no running stage, newest non-prompt event a commit", () => {
		const events = [
			pipelineStarted("p1", 1),
			phaseFinished("p1", "spec", 2),
			makeEvent("commit", { sha: "abcdef1" }, { seq: 3 }),
			makeEvent("prompt", { text: "next" }, { seq: 4 }),
		];

		const [rail] = build({ events });

		expect(rail.outside).toBe(true);
	});

	it("is not outside while a stage runs", () => {
		const events = [pipelineStarted("p1", 1), phaseStarted("p1", "build", 2), makeEvent("file_written", { path: "a.ts", action: "created" }, { seq: 3 })];

		const [rail] = build({ events, running: [makeRunning()] });

		expect(rail.outside).toBe(false);
	});
});
