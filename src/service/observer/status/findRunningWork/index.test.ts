import { describe, it, expect } from "vitest";
import type { ObserverEvent } from "@/types/index.js";
import type { Liveness, ModuleNode, SessionSummary, TreeFileEntry } from "../types/index.js";
import findRunningWork from "./index.js";

const PROJECT_ROOT = process.platform === "win32" ? "C:\\proj" : "/proj";
const NOW = Date.parse("2026-11-22T12:00:00.000Z");
const MINUTE = 60 * 1000;

function iso(msBeforeNow: number): string {
	return new Date(NOW - msBeforeNow).toISOString();
}

function makeEvent(
	kind: ObserverEvent["kind"],
	fields: Record<string, unknown>,
	envelope: { sessionId?: string; seq?: number; ts?: string } = {},
): ObserverEvent {
	return { v: 1, ts: iso(0), sessionId: "s1", seq: 1, pid: 100, kind, ...fields, ...envelope } as ObserverEvent;
}

function makeSession(sessionId: string, liveness: Liveness = "live"): SessionSummary {
	return {
		sessionId,
		startedAt: iso(60 * MINUTE),
		lastEventAt: iso(MINUTE),
		eventCount: 1,
		pid: 100,
		liveness,
		reported: null,
	};
}

function makePlan(
	folder: string,
	overrides: { status?: "proposed" | "approved" | "completed" | "abandoned" | "unset"; steps?: { done: number; total: number } } = {},
): TreeFileEntry {
	const steps = overrides.steps ?? { done: 0, total: 0 };
	const status = overrides.status ?? "approved";
	return {
		kind: "plan",
		file: `${folder}/plan.aide`,
		folder,
		read: {
			state: "present",
			status,
			awaitingApproval: status === "proposed",
			progress: { done: steps.done, total: steps.total, open: steps.total - steps.done },
			steps,
		},
	};
}

function makeNode(folder: string, files: TreeFileEntry[]): ModuleNode {
	return { folder, parent: folder === "." ? null : ".", files };
}

function started(phase: string, module: string, envelope: { sessionId?: string; seq?: number; ts?: string } = {}) {
	return makeEvent("phase_started", { phase, agent: `agent-${phase}`, module }, envelope);
}

function finished(phase: string, module: string, envelope: { sessionId?: string; seq?: number; ts?: string } = {}) {
	return makeEvent("phase_finished", { phase, agent: `agent-${phase}`, module }, envelope);
}

function run(events: ObserverEvent[], sessions: SessionSummary[], nodes: ModuleNode[] = []) {
	return findRunningWork({ projectRoot: PROJECT_ROOT, events, sessions, nodes, now: NOW });
}

describe("findRunningWork — open phase", () => {
	it("reports an open plan phase with phase, agent, module and elapsed time", () => {
		const events = [started("plan", "src/a", { seq: 1, ts: iso(5 * MINUTE) })];

		const [work] = run(events, [makeSession("s1")]);

		expect(work).toEqual({
			sessionId: "s1",
			phase: "plan",
			agent: "agent-plan",
			module: "src/a",
			startedAt: iso(5 * MINUTE),
			elapsedMs: 5 * MINUTE,
		});
	});

	it("is closed by a phase_finished for the same phase and module", () => {
		const events = [started("plan", "src/a", { seq: 1 }), finished("plan", "src/a", { seq: 2 })];

		expect(run(events, [makeSession("s1")])).toEqual([]);
	});

	it("is not closed by a phase_finished for another module", () => {
		const events = [started("plan", "src/a", { seq: 1 }), finished("plan", "src/b", { seq: 2 })];

		expect(run(events, [makeSession("s1")])).toHaveLength(1);
	});

	it("is not closed by a phase_finished for another phase", () => {
		const events = [started("plan", "src/a", { seq: 1 }), finished("spec", "src/a", { seq: 2 })];

		expect(run(events, [makeSession("s1")])).toHaveLength(1);
	});

	it("matches the module written as ./src/a/ against node src/a", () => {
		const events = [started("plan", "./src/a/", { seq: 1 }), finished("plan", "src/a", { seq: 2 })];

		expect(run(events, [makeSession("s1")])).toEqual([]);
	});

	it("reports the normalized module", () => {
		const events = [started("plan", "./src/a/", { seq: 1 })];

		expect(run(events, [makeSession("s1")])[0].module).toBe("src/a");
	});

	it("keeps the module text as recorded when it lies outside the project", () => {
		const events = [started("plan", "../elsewhere", { seq: 1 })];

		expect(run(events, [makeSession("s1")])[0].module).toBe("../elsewhere");
	});

	it("reports nothing for an ended session", () => {
		const events = [started("plan", "src/a", { seq: 1 })];

		expect(run(events, [makeSession("s1", "ended")])).toEqual([]);
	});

	it("reports an idle session's open phase", () => {
		const events = [started("plan", "src/a", { seq: 1 })];

		expect(run(events, [makeSession("s1", "idle")])).toHaveLength(1);
	});

	it("takes the latest start when the same session started a phase twice", () => {
		const events = [
			started("plan", "src/a", { seq: 1, ts: iso(10 * MINUTE) }),
			finished("plan", "src/a", { seq: 2, ts: iso(8 * MINUTE) }),
			started("build", "src/a", { seq: 3, ts: iso(2 * MINUTE) }),
		];
		const nodes = [makeNode("src/a", [makePlan("src/a")])];

		const work = run(events, [makeSession("s1")], nodes);

		expect(work).toHaveLength(1);
		expect(work[0].phase).toBe("build");
	});
});

describe("findRunningWork — several sessions", () => {
	it("lists two live sessions newest start first", () => {
		const events = [
			started("plan", "src/a", { sessionId: "old", seq: 1, ts: iso(20 * MINUTE) }),
			started("spec", "src/b", { sessionId: "new", seq: 1, ts: iso(2 * MINUTE) }),
		];
		const sessions = [makeSession("old"), makeSession("new")];

		const work = run(events, sessions);

		expect(work.map((entry) => entry.sessionId)).toEqual(["new", "old"]);
	});

	it.each([
		["input order a, b", ["a", "b"]],
		["input order b, a", ["b", "a"]],
	])("breaks a startedAt tie by sessionId descending (%s)", (_label, order) => {
		const ts = iso(3 * MINUTE);
		const events = order.map((sessionId) => started("plan", `src/${sessionId}`, { sessionId, seq: 1, ts }));
		const sessions = order.map((sessionId) => makeSession(sessionId));

		const work = run(events, sessions);

		expect(work.map((entry) => entry.sessionId)).toEqual(["b", "a"]);
	});
});

describe("findRunningWork — files win for Build", () => {
	it("drops a Build entry when the module's plan is proposed", () => {
		const events = [started("build", "src/a", { seq: 1 })];
		const nodes = [makeNode("src/a", [makePlan("src/a", { status: "proposed" })])];

		expect(run(events, [makeSession("s1")], nodes)).toEqual([]);
	});

	it("drops a Build entry when the module has no plan file", () => {
		const events = [started("build", "src/a", { seq: 1 })];

		expect(run(events, [makeSession("s1")], [])).toEqual([]);
		expect(run(events, [makeSession("s1")], [makeNode("src/a", [])])).toEqual([]);
	});

	it("reports the Build step from the plan file, not from plan_step_checked events", () => {
		const events = [
			started("build", "src/a", { seq: 1 }),
			makeEvent("plan_step_checked", { module: "src/a", step: 7, total: 9 }, { seq: 2 }),
		];
		const nodes = [makeNode("src/a", [makePlan("src/a", { steps: { done: 3, total: 9 } })])];

		const [work] = run(events, [makeSession("s1")], nodes);

		expect(work.buildStep).toEqual({ reached: 4, total: 9 });
	});

	it("caps the reached step at the total", () => {
		const events = [started("build", "src/a", { seq: 1 })];
		const nodes = [makeNode("src/a", [makePlan("src/a", { steps: { done: 9, total: 9 } })])];

		const [work] = run(events, [makeSession("s1")], nodes);

		expect(work.buildStep).toEqual({ reached: 9, total: 9 });
	});

	it("omits the Build step when the plan has no numbered steps", () => {
		const events = [started("build", "src/a", { seq: 1 })];
		const nodes = [makeNode("src/a", [makePlan("src/a", { steps: { done: 0, total: 0 } })])];

		const [work] = run(events, [makeSession("s1")], nodes);

		expect(work.buildStep).toBeUndefined();
	});

	it("does not need the plan to be approved for other phases", () => {
		const events = [started("plan", "src/a", { seq: 1 })];
		const nodes = [makeNode("src/a", [makePlan("src/a", { status: "proposed" })])];

		const [work] = run(events, [makeSession("s1")], nodes);

		expect(work.phase).toBe("plan");
		expect(work.buildStep).toBeUndefined();
	});
});

describe("findRunningWork — QA and Fix rounds", () => {
	it("numbers QA after one issues verdict as round 2", () => {
		const events = [
			started("qa", "src/a", { seq: 1 }),
			makeEvent("qa_verdict", { module: "src/a", verdict: "issues", open: 2 }, { seq: 2 }),
			started("qa", "src/a", { seq: 3 }),
		];

		const [work] = run(events, [makeSession("s1")]);

		expect(work.qaFixRound).toBe(2);
	});

	it("numbers a first QA as round 1", () => {
		const events = [started("qa", "src/a", { seq: 1 })];

		expect(run(events, [makeSession("s1")])[0].qaFixRound).toBe(1);
	});

	it("numbers Fix after one verdict as round 1", () => {
		const events = [
			started("qa", "src/a", { seq: 1 }),
			makeEvent("qa_verdict", { module: "src/a", verdict: "issues" }, { seq: 2 }),
			started("fix", "src/a", { seq: 3 }),
		];

		const [work] = run(events, [makeSession("s1")]);

		expect(work.qaFixRound).toBe(1);
	});

	it("numbers Fix with no recorded verdict as round 1", () => {
		const events = [started("fix", "src/a", { seq: 1 })];

		expect(run(events, [makeSession("s1")])[0].qaFixRound).toBe(1);
	});

	it("ignores verdicts for other modules and other sessions", () => {
		const events = [
			makeEvent("qa_verdict", { module: "src/b", verdict: "issues" }, { seq: 1 }),
			makeEvent("qa_verdict", { module: "src/a", verdict: "issues" }, { sessionId: "other", seq: 1 }),
			started("qa", "src/a", { seq: 2 }),
		];

		const [work] = run(events, [makeSession("s1")]);

		expect(work.qaFixRound).toBe(1);
	});

	it("leaves qaFixRound off other phases", () => {
		const events = [started("plan", "src/a", { seq: 1 })];

		expect(run(events, [makeSession("s1")])[0].qaFixRound).toBeUndefined();
	});
});
