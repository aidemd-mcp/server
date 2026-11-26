import { describe, expect, it } from "vitest";
import PHASE_LABELS from "@/service/observer/status/shared/phaseLabels/index.js";
import type { ModuleNode, ObserverEvent, PipelineRail, Phase, RailPhase, RunningWork, Status, WaitingFile } from "@/types/index.js";
import buildRailView from "./index.js";

const MODULE = "src/tools/score";
const SESSION = "s1";
const PIPELINE = "p1";
const NOW = new Date("2026-01-01T10:00:00.000Z");

const NAMES = ["Spec", "Research", "Synthesize", "Plan", "Plan approval", "Build", "QA", "Fix", "Done"];

type StageShape = { running?: Partial<RailPhase> & { phase: Phase }; done?: Phase[]; skipped?: Partial<Record<Phase, string>> };

function railOf({
	running,
	done = [],
	skipped = {},
	pipeline = PIPELINE,
	sessionId = SESSION,
	outside = false,
}: StageShape & { pipeline?: string | null; sessionId?: string; outside?: boolean }): PipelineRail {
	const stages = (Object.keys(PHASE_LABELS) as Phase[]).map((phase): RailPhase => {
		if (running && running.phase === phase) return { label: PHASE_LABELS[phase], state: "running", ...running };
		if (phase in skipped) return { phase, label: PHASE_LABELS[phase], state: "skipped", reason: skipped[phase] as string };
		return { phase, label: PHASE_LABELS[phase], state: done.includes(phase) ? "done" : "pending" };
	});
	return { sessionId, pipeline, pipelineState: "running", outside, stages };
}

function planNode(steps: { done: number; total: number }): ModuleNode {
	return {
		folder: MODULE,
		parent: ".",
		files: [
			{
				kind: "plan",
				file: `${MODULE}/plan.aide`,
				folder: MODULE,
				read: { state: "present", status: "approved", awaitingApproval: false, progress: { ...steps, open: steps.total - steps.done }, steps },
			},
		],
	};
}

function workOf({ phase, elapsedMs, qaFixRound }: { phase: Phase; elapsedMs: number; qaFixRound?: number }): RunningWork {
	return {
		sessionId: SESSION,
		phase,
		agent: "a",
		module: MODULE,
		startedAt: new Date(NOW.getTime() - elapsedMs).toISOString(),
		elapsedMs,
		...(qaFixRound === undefined ? {} : { qaFixRound }),
	};
}

function statusOf({
	rails = [],
	waiting = [],
	running = [],
	tree = [],
}: {
	rails?: PipelineRail[];
	waiting?: WaitingFile[];
	running?: RunningWork[];
	tree?: ModuleNode[];
}): Status {
	return {
		projectRoot: "/work/app",
		generatedAt: NOW.toISOString(),
		tree,
		workFiles: [],
		sessionRecord: { state: "missing" },
		sessions: [],
		running,
		waiting,
		surfaced: waiting[0] ?? null,
		rails,
		history: [],
		board: { state: "unavailable", reason: "no-kanban-field", detail: "", hint: "" },
		problems: [],
	};
}

let seq = 0;
/** One held event of pipeline `p1` in session `s1` by default; pass `pipeline: undefined` for an event that names none. */
function event(fields: Record<string, unknown> & { kind: ObserverEvent["kind"]; ts?: string; sessionId?: string }): ObserverEvent {
	seq += 1;
	return { v: 2, ts: "2026-01-01T09:00:00.000Z", sessionId: SESSION, seq, pid: 1, pipeline: PIPELINE, ...fields } as ObserverEvent;
}

const at = (time: string): string => `2026-01-01T${time}.000Z`;

const waitingPlan: WaitingFile = {
	file: `${MODULE}/plan.aide`,
	folder: MODULE,
	kind: "plan",
	gate: "approve plan",
	sessionId: SESSION,
	seq: 1,
	since: at("09:58:00"),
};

function cellOf(view: ReturnType<typeof buildRailView>, name: string) {
	return view.phases.find((cell) => cell.name === name);
}

describe("buildRailView", () => {
	describe("which rail", () => {
		it.each([
			["no status", null],
			["a status with no rail", statusOf({})],
		])("is hidden with nine named cells and four lanes, all not started (%s)", (_label, status) => {
			const view = buildRailView({ status, events: [], focus: null, now: NOW });
			expect(view).toMatchObject({ hidden: true, module: null, pipeline: null, outside: false });
			expect(view.phases.map((cell) => cell.name)).toEqual(NAMES);
			expect(view.phases.every((cell) => cell.state === "todo" && cell.meta === "Not started" && cell.loop === null)).toBe(true);
			expect(view.lanes.map((lane) => lane.name)).toEqual(["Structure", "Align", "Refactor", "Cleanup"]);
			expect(view.lanes.every((lane) => lane.state === "todo" && lane.meta === "Not started")).toBe(true);
		});

		it("is hidden for an ended session, which has no rail, even while another session's rail exists", () => {
			const status = statusOf({ rails: [railOf({ running: { phase: "build" }, sessionId: "live" })] });
			const events = [event({ kind: "phase_finished", phase: "qa", agent: "a", module: MODULE, sessionId: "ended" })];
			const view = buildRailView({ status, events, focus: "ended", now: NOW });
			expect(view.hidden).toBe(true);
			expect(view.phases.every((cell) => cell.state === "todo")).toBe(true);
			expect(view.module).toBeNull();
		});

		it("takes the focused session's rail, else the first rail when no session is focused", () => {
			const status = statusOf({ rails: [railOf({ pipeline: "first", sessionId: "a" }), railOf({ pipeline: "second", sessionId: "b" })] });
			expect(buildRailView({ status, events: [], focus: "b", now: NOW })).toMatchObject({ hidden: false, pipeline: "second" });
			expect(buildRailView({ status, events: [], focus: null, now: NOW })).toMatchObject({ hidden: false, pipeline: "first" });
		});

		it("names the rail's pipeline, or none for a session that reported none", () => {
			expect(buildRailView({ status: statusOf({ rails: [railOf({ pipeline: "feature-x" })] }), events: [], focus: SESSION, now: NOW }).pipeline).toBe("feature-x");
			expect(buildRailView({ status: statusOf({ rails: [railOf({ pipeline: null })] }), events: [], focus: SESSION, now: NOW }).pipeline).toBeNull();
		});
	});

	it("draws a resumed pipeline: earlier stages done, Build running at its step, nothing extra", () => {
		const status = statusOf({
			rails: [railOf({ running: { phase: "build", buildStep: { reached: 4, total: 9 } }, done: ["spec", "research", "synthesize", "plan"] })],
			running: [workOf({ phase: "build", elapsedMs: 472_000 })],
		});
		const events = [
			event({ kind: "pipeline_started", phase: "build" }),
			event({ kind: "phase_started", phase: "spec", agent: "a", module: MODULE, ts: at("08:00:00") }),
			event({ kind: "phase_finished", phase: "spec", agent: "a", module: MODULE, ts: at("08:02:10") }),
			event({ kind: "gate_waiting", gate: "approve plan", file: `${MODULE}/plan.aide`, ts: at("08:20:00") }),
			event({ kind: "gate_resolved", gate: "approve plan", file: `/work/app/${MODULE}/plan.aide`, ts: at("08:24:12") }),
		];
		const view = buildRailView({ status, events, focus: SESSION, now: NOW });
		expect(view.hidden).toBe(false);
		expect(view.phases).toHaveLength(9);
		expect(view.module).toBe(MODULE);
		expect(view.phases.map((cell) => [cell.name, cell.state, cell.meta])).toEqual([
			["Spec", "done", "Done 2m 10s"],
			["Research", "done", "Done"],
			["Synthesize", "done", "Done"],
			["Plan", "done", "Done"],
			["Plan approval", "done", "Approved 4m 12s"],
			["Build", "run", "Step 4 of 9"],
			["QA", "todo", "Not started"],
			["Fix", "todo", "Not started"],
			["Done", "todo", "Not started"],
		]);
		expect(view.phases.every((cell) => cell.loop === null)).toBe(true);
	});

	it("draws QA failed in round 2 beside a running Fix with the loop badge", () => {
		const status = statusOf({
			rails: [railOf({ running: { phase: "fix", qaFixRound: 2 }, done: ["spec", "build"] })],
			running: [workOf({ phase: "fix", elapsedMs: 65_000, qaFixRound: 2 })],
		});
		const events = [
			event({ kind: "qa_verdict", module: MODULE, verdict: "issues", open: 3 }),
			event({ kind: "qa_verdict", module: MODULE, verdict: "issues", open: 2 }),
		];
		const view = buildRailView({ status, events, focus: SESSION, now: NOW });
		expect(cellOf(view, "QA")).toEqual({ name: "QA", state: "fail", meta: "2 issues · round 2", loop: null });
		expect(cellOf(view, "Fix")).toEqual({ name: "Fix", state: "run", meta: "Round 2 · 1m 05s", loop: "round 2" });
		expect(view.phases.filter((cell) => cell.loop !== null)).toHaveLength(1);
	});

	it("keeps counting a running phase from the status's elapsed time", () => {
		const status = statusOf({
			rails: [railOf({ running: { phase: "research" }, done: ["spec"] })],
			running: [{ ...workOf({ phase: "research", elapsedMs: 100_000 }), module: `/work/app/${MODULE}` }],
		});
		const events = [event({ kind: "phase_started", phase: "research", agent: "a", module: MODULE })];
		const later = new Date(NOW.getTime() + 12_000);
		expect(cellOf(buildRailView({ status, events, focus: SESSION, now: later }), "Research")).toMatchObject({ state: "run", meta: "Running 1m 52s" });
	});

	it("leaves the elapsed part out when the status holds no running work for the cell", () => {
		const view = buildRailView({ status: statusOf({ rails: [railOf({ running: { phase: "plan" } })] }), events: [], focus: SESSION, now: NOW });
		expect(cellOf(view, "Plan")).toMatchObject({ state: "run", meta: "Running", loop: null });
	});

	it("reads a running Fix without a reported round as plain running", () => {
		const status = statusOf({ rails: [railOf({ running: { phase: "fix" } })], running: [workOf({ phase: "fix", elapsedMs: 30_000 })] });
		expect(cellOf(buildRailView({ status, events: [], focus: SESSION, now: NOW }), "Fix")).toMatchObject({ state: "run", meta: "Running 30s", loop: null });
	});

	describe("skipped stages", () => {
		it("draws a skipped cell in the not-started look with `Skipped · <reason>`", () => {
			const status = statusOf({ rails: [railOf({ skipped: { research: "domain already known", synthesize: "single module" }, done: ["spec"], running: { phase: "plan" } })] });
			const view = buildRailView({ status, events: [], focus: SESSION, now: NOW });
			expect(cellOf(view, "Spec")).toMatchObject({ state: "done" });
			expect(cellOf(view, "Research")).toEqual({ name: "Research", state: "todo", meta: "Skipped · domain already known", loop: null, skipped: true });
			expect(cellOf(view, "Synthesize")).toEqual({ name: "Synthesize", state: "todo", meta: "Skipped · single module", loop: null, skipped: true });
		});

		it("draws a skipped side lane the same way", () => {
			const view = buildRailView({ status: statusOf({ rails: [railOf({ skipped: { structure: "no new folders" } })] }), events: [], focus: SESSION, now: NOW });
			expect(view.lanes.find((lane) => lane.name === "Structure")).toEqual({ name: "Structure", state: "todo", meta: "Skipped · no new folders", skipped: true });
		});
	});

	describe("working outside the pipeline", () => {
		it("carries the rail's own report, with no cell running", () => {
			const status = statusOf({ rails: [railOf({ done: ["spec", "build"], outside: true })] });
			const view = buildRailView({ status, events: [], focus: SESSION, now: NOW });
			expect(view).toMatchObject({ outside: true, hidden: false, pipeline: PIPELINE });
			expect(view.phases.some((cell) => cell.state === "run")).toBe(false);
		});

		it("is not outside while the rail says it is not", () => {
			expect(buildRailView({ status: statusOf({ rails: [railOf({ running: { phase: "qa" } })] }), events: [], focus: SESSION, now: NOW }).outside).toBe(false);
		});
	});

	describe("a rail with no pipeline", () => {
		it("reads only the session's events that name no pipeline", () => {
			const status = statusOf({ rails: [railOf({ pipeline: null, done: ["build", "qa"] })] });
			const events = [
				event({ kind: "phase_started", phase: "build", agent: "a", module: MODULE, ts: at("09:00:00"), pipeline: undefined, v: 1 }),
				event({ kind: "phase_finished", phase: "build", agent: "a", module: MODULE, ts: at("09:10:00"), pipeline: undefined, v: 1 }),
				event({ kind: "phase_started", phase: "spec", agent: "a", module: MODULE, ts: at("08:00:00") }),
				event({ kind: "phase_finished", phase: "spec", agent: "a", module: MODULE, ts: at("08:30:00") }),
			];
			const view = buildRailView({ status, events, focus: SESSION, now: NOW });
			expect(cellOf(view, "Build")?.meta).toBe("Done 10m 00s");
			expect(view.pipeline).toBeNull();
		});
	});

	describe("Plan approval", () => {
		const rails = [railOf({ done: ["plan"] })];

		it("waits while a gate of the pipeline names a plan the status still lists as waiting", () => {
			const events = [event({ kind: "gate_waiting", gate: "approve plan", file: `${MODULE}/plan.aide`, ts: at("09:58:00") })];
			const view = buildRailView({ status: statusOf({ rails, waiting: [waitingPlan] }), events, focus: SESSION, now: NOW });
			expect(cellOf(view, "Plan approval")).toMatchObject({ state: "wait", meta: "Waiting · 2m" });
		});

		it("is approved with how long the gate stood open", () => {
			const events = [
				event({ kind: "gate_waiting", gate: "approve plan", file: `${MODULE}/plan.aide`, ts: at("09:00:00") }),
				event({ kind: "gate_resolved", gate: "approve plan", file: `${MODULE}/plan.aide`, ts: at("09:06:02") }),
			];
			expect(cellOf(buildRailView({ status: statusOf({ rails }), events, focus: SESSION, now: NOW }), "Plan approval")).toMatchObject({
				state: "done",
				meta: "Approved 6m 02s",
			});
		});

		it("is plain Approved when the opening event is not held", () => {
			const events = [event({ kind: "gate_resolved", gate: "approve plan", file: `${MODULE}/plan.aide` })];
			expect(cellOf(buildRailView({ status: statusOf({ rails }), events, focus: SESSION, now: NOW }), "Plan approval")).toMatchObject({
				state: "done",
				meta: "Approved",
			});
		});

		it("never fills from another pipeline's gate, even when that gate names the same plan and is still waiting", () => {
			const events = [
				event({ kind: "gate_resolved", gate: "approve plan", file: `${MODULE}/plan.aide`, pipeline: "other-pipeline" }),
				event({ kind: "gate_waiting", gate: "approve plan", file: `${MODULE}/plan.aide`, pipeline: "other-pipeline", sessionId: "other" }),
				event({ kind: "gate_resolved", gate: "approve todo", file: `${MODULE}/todo.aide` }),
			];
			const view = buildRailView({ status: statusOf({ rails, waiting: [waitingPlan] }), events, focus: SESSION, now: NOW });
			expect(cellOf(view, "Plan approval")).toMatchObject({ state: "todo", meta: "Not started" });
		});

		it("counts a gate of the same pipeline that another session recorded", () => {
			const events = [event({ kind: "gate_resolved", gate: "approve plan", file: `${MODULE}/plan.aide`, sessionId: "other" })];
			expect(cellOf(buildRailView({ status: statusOf({ rails }), events, focus: SESSION, now: NOW }), "Plan approval")?.state).toBe("done");
		});

		it("has no waiting state without a status, because no open gate can be read", () => {
			expect(cellOf(buildRailView({ status: null, events: [], focus: SESSION, now: NOW }), "Plan approval")?.state).toBe("todo");
		});
	});

	describe("finished cells", () => {
		it("reads Build as `Done <done> of <total>` from the plan's steps, else from its duration", () => {
			const rails = [railOf({ done: ["build"] })];
			const events = [
				event({ kind: "phase_started", phase: "build", agent: "a", module: MODULE, ts: at("09:00:00") }),
				event({ kind: "phase_finished", phase: "build", agent: "a", module: MODULE, ts: at("09:10:30") }),
			];
			const withPlan = statusOf({ rails, tree: [planNode({ done: 9, total: 9 })] });
			expect(cellOf(buildRailView({ status: withPlan, events, focus: SESSION, now: NOW }), "Build")).toMatchObject({ state: "done", meta: "Done 9 of 9" });
			expect(cellOf(buildRailView({ status: statusOf({ rails }), events, focus: SESSION, now: NOW }), "Build")).toMatchObject({ meta: "Done 10m 30s" });
		});

		it("takes a duration only from the pipeline's own events", () => {
			const events = [
				event({ kind: "phase_started", phase: "plan", agent: "a", module: MODULE, ts: at("09:00:00") }),
				event({ kind: "phase_finished", phase: "plan", agent: "a", module: MODULE, ts: at("09:03:41") }),
				event({ kind: "phase_started", phase: "spec", agent: "a", module: MODULE, ts: at("08:00:00"), pipeline: "other-pipeline" }),
				event({ kind: "phase_finished", phase: "spec", agent: "a", module: MODULE, ts: at("08:10:00"), pipeline: "other-pipeline" }),
			];
			const view = buildRailView({ status: statusOf({ rails: [railOf({ done: ["plan", "spec"] })] }), events, focus: SESSION, now: NOW });
			expect(cellOf(view, "Plan")?.meta).toBe("Done 3m 41s");
			expect(cellOf(view, "Spec")?.meta).toBe("Done");
		});
	});

	describe("QA and Done", () => {
		const rails = [railOf({ done: ["build", "qa"] })];
		const qaRun = [
			event({ kind: "phase_started", phase: "qa", agent: "a", module: MODULE, ts: at("09:20:00") }),
			event({ kind: "phase_finished", phase: "qa", agent: "a", module: MODULE, ts: at("09:22:48") }),
		];

		it.each([
			["issues with a count", { open: 1 }, "fail", "1 issue · round 1"],
			["issues without a count", {}, "fail", "issues · round 1"],
		] as const)("a first verdict of %s is %s", (_label, fields, state, meta) => {
			const events = [...qaRun, event({ kind: "qa_verdict", module: MODULE, verdict: "issues", ...fields })];
			expect(cellOf(buildRailView({ status: statusOf({ rails }), events, focus: SESSION, now: NOW }), "QA")).toMatchObject({ state, meta });
		});

		it("passes with its duration and lights Done with the verdict's clock time", () => {
			const verdict = event({ kind: "qa_verdict", module: MODULE, verdict: "passed", ts: at("09:23:00") });
			const view = buildRailView({ status: statusOf({ rails }), events: [...qaRun, verdict], focus: SESSION, now: NOW });
			const clock = (value: number) => String(value).padStart(2, "0");
			const when = new Date(verdict.ts);
			expect(cellOf(view, "QA")).toMatchObject({ state: "done", meta: "Passed 2m 48s" });
			expect(cellOf(view, "Done")).toMatchObject({ state: "done", meta: `Done ${clock(when.getHours())}:${clock(when.getMinutes())}` });
		});

		it("lets the newest verdict decide after a fix round", () => {
			const events = [
				...qaRun,
				event({ kind: "qa_verdict", module: MODULE, verdict: "issues", open: 2 }),
				event({ kind: "qa_verdict", module: MODULE, verdict: "passed" }),
			];
			const view = buildRailView({ status: statusOf({ rails }), events, focus: SESSION, now: NOW });
			expect(cellOf(view, "QA")?.state).toBe("done");
			expect(cellOf(view, "Done")?.state).toBe("done");
		});

		it("shows a running QA as running whatever an earlier round found", () => {
			const status = statusOf({
				rails: [railOf({ running: { phase: "qa", qaFixRound: 2 }, done: ["build", "fix"] })],
				running: [workOf({ phase: "qa", elapsedMs: 5_000, qaFixRound: 2 })],
			});
			const events = [event({ kind: "qa_verdict", module: MODULE, verdict: "issues", open: 2 })];
			expect(cellOf(buildRailView({ status, events, focus: SESSION, now: NOW }), "QA")).toMatchObject({ state: "run", meta: "Running 5s" });
		});

		it("does not light Done or fail QA from another pipeline's verdict", () => {
			const events = [
				event({ kind: "qa_verdict", module: MODULE, verdict: "passed", pipeline: "other-pipeline" }),
				event({ kind: "qa_verdict", module: MODULE, verdict: "issues", open: 4, pipeline: "other-pipeline", sessionId: "other" }),
			];
			const view = buildRailView({ status: statusOf({ rails }), events, focus: SESSION, now: NOW });
			expect(cellOf(view, "Done")?.state).toBe("todo");
			expect(cellOf(view, "QA")).toMatchObject({ state: "done", meta: "Done" });
		});
	});

	describe("side lanes", () => {
		it.each([
			["running", { running: { phase: "align" as const } }, "run", "Running"],
			["finished", { done: ["align" as const] }, "done", "Done"],
			["not run", {}, "todo", "Not started"],
		])("a %s lane reads %s", (_label, shape, state, meta) => {
			const view = buildRailView({ status: statusOf({ rails: [railOf(shape)] }), events: [], focus: SESSION, now: NOW });
			expect(view.lanes.find((lane) => lane.name === "Align")).toEqual({ name: "Align", state, meta });
		});

		it("never marks a lane failed, because no event reports that", () => {
			const view = buildRailView({ status: statusOf({ rails: [railOf({ done: ["structure", "cleanup"] })] }), events: [], focus: SESSION, now: NOW });
			expect(view.lanes.map((lane) => lane.state)).toEqual(["done", "todo", "todo", "done"]);
		});
	});
});
