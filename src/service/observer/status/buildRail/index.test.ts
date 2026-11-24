import { describe, it, expect } from "vitest";
import type { ObserverEvent } from "@/types/index.js";
import type { RunningWork, WaitingFile } from "../types/index.js";
import PHASE_LABELS from "../shared/phaseLabels/index.js";
import buildRail from "./index.js";

const PROJECT_ROOT = process.platform === "win32" ? "C:\\proj" : "/proj";
const PHASE_ORDER = [
	"spec",
	"research",
	"synthesize",
	"structure",
	"plan",
	"build",
	"qa",
	"fix",
	"align",
	"refactor",
	"cleanup",
];

function makeEvent(
	kind: ObserverEvent["kind"],
	fields: Record<string, unknown>,
	envelope: { sessionId?: string; seq?: number; ts?: string } = {},
): ObserverEvent {
	return {
		v: 1,
		ts: "2026-11-22T12:00:00.000Z",
		sessionId: "s1",
		seq: 1,
		pid: 100,
		kind,
		...fields,
		...envelope,
	} as ObserverEvent;
}

function finished(phase: string, module: string, sessionId = "s1"): ObserverEvent {
	return makeEvent("phase_finished", { phase, agent: `agent-${phase}`, module }, { sessionId });
}

function makeRunning(overrides: Partial<RunningWork> = {}): RunningWork {
	return {
		sessionId: "s1",
		phase: "build",
		agent: "aide-implementor",
		module: "src/a",
		startedAt: "2026-11-22T11:00:00.000Z",
		elapsedMs: 3_600_000,
		...overrides,
	};
}

function makeWaiting(overrides: Partial<WaitingFile> = {}): WaitingFile {
	return {
		file: "src/b/plan.aide",
		folder: "src/b",
		kind: "plan",
		gate: "plan-approval",
		sessionId: "s1",
		seq: 3,
		since: "2026-11-22T11:30:00.000Z",
		...overrides,
	};
}

function rail(input: { events?: ObserverEvent[]; running?: RunningWork[]; surfaced?: WaitingFile | null }) {
	return buildRail({
		projectRoot: PROJECT_ROOT,
		events: input.events ?? [],
		running: input.running ?? [],
		surfaced: input.surfaced ?? null,
	});
}

function states(result: NonNullable<ReturnType<typeof buildRail>>): Record<string, string> {
	return Object.fromEntries(result.phases.map((entry) => [entry.phase, entry.state]));
}

describe("buildRail — which module", () => {
	it("returns null with no running work and no surfaced file", () => {
		expect(rail({ events: [finished("spec", "src/a")] })).toBeNull();
	});

	it("follows running work over a surfaced file", () => {
		const result = rail({ running: [makeRunning()], surfaced: makeWaiting() })!;
		expect(result.module).toBe("src/a");
		expect(result.source).toBe("running");
	});

	it("follows running[0] when two are running", () => {
		const result = rail({
			running: [makeRunning({ module: "src/a", sessionId: "s1" }), makeRunning({ module: "src/z", sessionId: "s2" })],
		})!;
		expect(result.module).toBe("src/a");
		expect(result.sessionId).toBe("s1");
	});

	it("uses the surfaced file's folder and session when nothing is running", () => {
		const result = rail({
			events: [finished("spec", "src/b"), finished("plan", "src/b")],
			surfaced: makeWaiting(),
		})!;
		expect(result.source).toBe("surfaced");
		expect(result.module).toBe("src/b");
		expect(result.sessionId).toBe("s1");
		expect(states(result)).toMatchObject({ spec: "done", plan: "done" });
		expect(result.phases.some((entry) => entry.state === "running")).toBe(false);
	});

	it("handles a surfaced intent spec at the root", () => {
		const result = rail({
			events: [finished("spec", ".")],
			surfaced: makeWaiting({ file: ".aide/intent.aide", folder: ".", kind: "intent" }),
		})!;
		expect(result.module).toBe(".");
		expect(states(result).spec).toBe("done");
	});
});

describe("buildRail — phases", () => {
	it("lists all 11 phases in list order, labelled from PHASE_LABELS", () => {
		const result = rail({ running: [makeRunning()] })!;
		expect(result.phases.map((entry) => entry.phase)).toEqual(PHASE_ORDER);
		for (const entry of result.phases) expect(entry.label).toBe(PHASE_LABELS[entry.phase]);
	});

	it("marks finished phases done, the running one running and the rest not-run, carrying buildStep", () => {
		const buildStep = { reached: 4, total: 9 };
		const result = rail({
			events: [finished("spec", "src/a"), finished("plan", "src/a")],
			running: [makeRunning({ buildStep })],
		})!;
		expect(states(result)).toEqual({
			spec: "done",
			research: "not-run",
			synthesize: "not-run",
			structure: "not-run",
			plan: "done",
			build: "running",
			qa: "not-run",
			fix: "not-run",
			align: "not-run",
			refactor: "not-run",
			cleanup: "not-run",
		});
		expect(result.phases.find((entry) => entry.phase === "build")!.buildStep).toEqual(buildStep);
		expect(result.phases.filter((entry) => entry.buildStep !== undefined)).toHaveLength(1);
	});

	it("ignores finishes for another module or another session", () => {
		const result = rail({
			events: [finished("plan", "src/b"), finished("spec", "src/a", "s2")],
			running: [makeRunning()],
		})!;
		expect(states(result).plan).toBe("not-run");
		expect(states(result).spec).toBe("not-run");
	});

	it("shows a second QA round as running with its round, not done", () => {
		const result = rail({
			events: [finished("qa", "src/a")],
			running: [makeRunning({ phase: "qa", qaFixRound: 2 })],
		})!;
		const qa = result.phases.find((entry) => entry.phase === "qa")!;
		expect(qa.state).toBe("running");
		expect(qa.qaFixRound).toBe(2);
	});

	it("carries qaFixRound on a running fix", () => {
		const result = rail({ running: [makeRunning({ phase: "fix", qaFixRound: 1 })] })!;
		expect(result.phases.find((entry) => entry.phase === "fix")).toMatchObject({ state: "running", qaFixRound: 1 });
	});

	it("matches a finish whose module is written ./src/a/", () => {
		const result = rail({ events: [finished("plan", "./src/a/")], running: [makeRunning()] })!;
		expect(states(result).plan).toBe("done");
	});

	it("matches a finish whose module is outside the project by its text as given", () => {
		const result = rail({
			events: [finished("plan", "../elsewhere")],
			running: [makeRunning({ module: "../elsewhere" })],
		})!;
		expect(states(result).plan).toBe("done");
	});

	it("adds nothing for a phase_started with no finish", () => {
		const result = rail({
			events: [makeEvent("phase_started", { phase: "spec", agent: "aide-spec-writer", module: "src/a" })],
			running: [makeRunning()],
		})!;
		expect(states(result).spec).toBe("not-run");
	});

	it("does not mark phases running or done on a surfaced rail without a finish event", () => {
		const result = rail({ surfaced: makeWaiting() })!;
		expect(result.phases.every((entry) => entry.state === "not-run")).toBe(true);
	});
});
