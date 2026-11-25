import { describe, expect, it } from "vitest";
import type { ObserverEvent, PipelineRail, RunningWork, SessionSummary, Status, WaitingFile, WorkFileEntry } from "@/types/index.js";
import formatClock from "@/observer/page/shared/formatClock/index.js";
import buildNowCard from "./index.js";
import makeLiveness from "@/observer/page/__fixtures__/makeLiveness/index.js";

const NOW = new Date("2026-01-01T10:00:00.000Z");
const MODULE = "src/tools/score";
const HINT_WAIT = "The agent is paused until you answer in its session. This page is read-only.";
const clock = (iso: string): string => formatClock({ iso, now: NOW }).clock;

function statusOf(overrides: Partial<Status> = {}): Status {
	return {
		projectRoot: "/work/app",
		generatedAt: NOW.toISOString(),
		tree: [],
		workFiles: [],
		sessionRecord: { state: "missing" },
		sessions: [],
		running: [],
		waiting: [],
		surfaced: null,
		rails: [],
		history: [],
		board: { state: "unavailable", reason: "no-brain-path", detail: "", hint: "" },
		problems: [],
		...overrides,
	};
}

function work(fields: Partial<RunningWork> & Pick<RunningWork, "sessionId" | "phase">): RunningWork {
	return { agent: "aide-implementor", module: MODULE, startedAt: "2026-01-01T09:55:48.000Z", elapsedMs: 252_000, ...fields };
}

function todoEntry({ open, total }: { open: number; total: number }): WorkFileEntry {
	return {
		kind: "todo",
		file: `${MODULE}/todo.aide`,
		folder: MODULE,
		read: { state: "present", status: "approved", awaitingApproval: false, progress: { done: total - open, total, open }, steps: { done: total - open, total } },
	};
}

function waitingOf(fields: Partial<WaitingFile> = {}): WaitingFile {
	return {
		file: `${MODULE}/plan.aide`,
		folder: MODULE,
		kind: "plan",
		gate: "approve plan",
		sessionId: "s1",
		seq: 9,
		since: "2026-01-01T09:58:00.000Z",
		...fields,
	};
}

function event(fields: Record<string, unknown> & { kind: ObserverEvent["kind"]; seq: number }): ObserverEvent {
	return { v: 1, ts: "2026-01-01T09:00:00.000Z", sessionId: "s1", pid: 1, ...fields } as ObserverEvent;
}

function summary({ sessionId, startedAt }: { sessionId: string; startedAt: string }): SessionSummary {
	return { sessionId, startedAt, lastEventAt: startedAt, eventCount: 2, pid: 1, liveness: makeLiveness(), reported: null };
}

describe("buildNowCard: wait", () => {
	it("is the amber card for the open gate, with who wrote the file and how long it has waited", () => {
		const events = [event({ kind: "phase_finished", seq: 5, phase: "plan", agent: "aide-architect", module: MODULE })];
		const card = buildNowCard({ status: statusOf({ waiting: [waitingOf()] }), events, focus: "s1", now: NOW });
		expect(card).toEqual({
			kind: "wait",
			state: "Waiting on you",
			icon: "wait",
			title: "Approve",
			titleMono: "plan.aide",
			sub: null,
			parts: [
				{ label: "for", value: MODULE, mono: true },
				{ label: "written by", value: "aide-architect", mono: true },
			],
			time: "2m",
			timeLabel: `waiting since ${clock("2026-01-01T09:58:00.000Z")}`,
			steps: null,
			hint: HINT_WAIT,
		});
	});

	it("leaves out `written by` when no phase finished for the module before the gate", () => {
		const events = [
			event({ kind: "phase_finished", seq: 12, phase: "plan", agent: "late", module: MODULE }),
			event({ kind: "phase_finished", seq: 4, phase: "plan", agent: "other-session", module: MODULE, sessionId: "s2" }),
			event({ kind: "phase_finished", seq: 3, phase: "plan", agent: "other-module", module: "src/x" }),
		];
		const card = buildNowCard({ status: statusOf({ waiting: [waitingOf()] }), events, focus: "s1", now: NOW });
		expect(card.parts).toEqual([{ label: "for", value: MODULE, mono: true }]);
	});

	it("outranks running work, and prefers the focused session's gate over another's", () => {
		const status = statusOf({
			waiting: [waitingOf({ sessionId: "s2", file: "src/b/brief.aide", folder: "src/b", kind: "brief" }), waitingOf()],
			running: [work({ sessionId: "s1", phase: "build" })],
		});
		expect(buildNowCard({ status, events: [], focus: "s1", now: NOW })).toMatchObject({ kind: "wait", titleMono: "plan.aide" });
		expect(buildNowCard({ status, events: [], focus: "s2", now: NOW })).toMatchObject({ kind: "wait", titleMono: "brief.aide" });
		expect(buildNowCard({ status, events: [], focus: "nope", now: NOW })).toMatchObject({ kind: "wait", titleMono: "brief.aide" });
	});

	it("names the project when the gate is on the root module", () => {
		const root = waitingOf({ file: ".aide/intent.aide", folder: ".", kind: "intent" });
		const card = buildNowCard({ status: statusOf({ waiting: [root] }), events: [], focus: "s1", now: NOW });
		expect(card.parts[0]).toEqual({ label: "for", value: "app", mono: true });
	});
});

describe("buildNowCard: run", () => {
	it("is the blue Build card with the step bar and the step's words", () => {
		const status = statusOf({ running: [work({ sessionId: "s1", phase: "build", buildStep: { reached: 4, total: 9 } })] });
		const card = buildNowCard({ status, events: [], focus: "s1", now: NOW, stepText: "Wire weights into the ranking" });
		expect(card).toEqual({
			kind: "run",
			state: "Running",
			icon: "run",
			title: "Build",
			titleMono: null,
			sub: "step 4 of 9",
			parts: [
				{ label: "agent", value: "aide-implementor", mono: true },
				{ label: "module", value: MODULE, mono: true },
			],
			time: "4m 12s",
			timeLabel: `elapsed · started ${clock("2026-01-01T09:55:48.000Z")}`,
			steps: { total: 9, done: 3, running: 1, head: "Step 4 of 9", text: "Wire weights into the ranking" },
			hint: null,
			pipeline: null,
		});
	});

	it("has no step text until it is loaded, and keeps counting between statuses", () => {
		const status = statusOf({ generatedAt: "2026-01-01T09:59:50.000Z", running: [work({ sessionId: "s1", phase: "build", buildStep: { reached: 1, total: 3 } })] });
		const card = buildNowCard({ status, events: [], focus: "s1", now: NOW });
		expect(card.steps).toEqual({ total: 3, done: 0, running: 1, head: "Step 1 of 3", text: null });
		expect(card.time).toBe("4m 22s");
	});

	it.each(["spec", "research", "synthesize", "plan"] as const)("is a plain run card for %s: no sub line, no steps", (phase) => {
		const card = buildNowCard({ status: statusOf({ running: [work({ sessionId: "s1", phase })] }), events: [], focus: "s1", now: NOW });
		expect(card).toMatchObject({ kind: "run", sub: null, steps: null, hint: null });
	});

	it("shows a first QA round as a run card", () => {
		const card = buildNowCard({ status: statusOf({ running: [work({ sessionId: "s1", phase: "qa", qaFixRound: 1 })] }), events: [], focus: "s1", now: NOW });
		expect(card).toMatchObject({ kind: "run", title: "QA" });
	});

	it("follows the focused session's work, else the first running", () => {
		const status = statusOf({ running: [work({ sessionId: "s1", phase: "build" }), work({ sessionId: "s2", phase: "spec", agent: "aide-spec-writer" })] });
		expect(buildNowCard({ status, events: [], focus: "s2", now: NOW })).toMatchObject({ title: "Spec" });
		expect(buildNowCard({ status, events: [], focus: "nope", now: NOW })).toMatchObject({ title: "Build" });
	});

	it("keeps two live sessions apart: each focus gets its own card", () => {
		const status = statusOf({
			sessions: [summary({ sessionId: "s1", startedAt: "2026-01-01T08:00:00.000Z" }), summary({ sessionId: "s2", startedAt: "2026-01-01T09:00:00.000Z" })],
			running: [work({ sessionId: "s1", phase: "build", buildStep: { reached: 2, total: 5 } }), work({ sessionId: "s2", phase: "research", agent: "aide-domain-expert", module: "src/service/install" })],
		});
		expect(buildNowCard({ status, events: [], focus: "s1", now: NOW }).sub).toBe("step 2 of 5");
		const second = buildNowCard({ status, events: [], focus: "s2", now: NOW });
		expect(second.title).toBe("Research");
		expect(second.parts).toContainEqual({ label: "module", value: "src/service/install", mono: true });
	});
});

describe("buildNowCard: pipeline", () => {
	const railOf = (fields: Partial<PipelineRail> = {}): PipelineRail => ({ sessionId: "s1", pipeline: "feature-x", pipelineState: "running", outside: false, stages: [], ...fields });
	const opening = event({ kind: "session_started", seq: 1 });
	const commit = event({ kind: "commit", seq: 2, sha: "414776fabc", ts: "2026-01-01T09:48:00.000Z" });

	it("names the pipeline of the running session's rail on a run card, and keeps the phase as the title", () => {
		const status = statusOf({ running: [work({ sessionId: "s1", phase: "build" })], rails: [railOf(), railOf({ sessionId: "s2", pipeline: "other" })] });
		expect(buildNowCard({ status, events: [], focus: "s1", now: NOW })).toMatchObject({ kind: "run", title: "Build", pipeline: "feature-x" });
		expect(buildNowCard({ status, events: [], focus: null, now: NOW })).toMatchObject({ pipeline: "feature-x" });
	});

	it("names the pipeline on a fix card", () => {
		const status = statusOf({ running: [work({ sessionId: "s1", phase: "fix", qaFixRound: 2 })], rails: [railOf()] });
		expect(buildNowCard({ status, events: [], focus: "s1", now: NOW })).toMatchObject({ kind: "fix", pipeline: "feature-x" });
	});

	it("names no pipeline when the rail names none or the session has no rail", () => {
		const running = [work({ sessionId: "s1", phase: "build" })];
		expect(buildNowCard({ status: statusOf({ running, rails: [railOf({ pipeline: null })] }), events: [], focus: "s1", now: NOW }).pipeline).toBeNull();
		expect(buildNowCard({ status: statusOf({ running }), events: [], focus: "s1", now: NOW }).pipeline).toBeNull();
	});

	it("reads No phase running for a session with a rail and no running phase", () => {
		const card = buildNowCard({ status: statusOf({ rails: [railOf()] }), events: [opening, commit], focus: "s1", now: NOW });
		expect(card).toMatchObject({ kind: "idle", state: "No phase running", pipeline: "feature-x" });
	});

	it("reads Working outside the pipeline when the rail says the session works outside it", () => {
		const card = buildNowCard({ status: statusOf({ rails: [railOf({ outside: true })] }), events: [opening, commit], focus: "s1", now: NOW });
		expect(card).toMatchObject({ kind: "idle", state: "Working outside the pipeline" });
	});

	it("keeps the amber waiting card when a gate is open, whatever the rail says", () => {
		const status = statusOf({ waiting: [waitingOf()], rails: [railOf({ outside: true })] });
		expect(buildNowCard({ status, events: [opening, commit], focus: "s1", now: NOW })).toMatchObject({ kind: "wait", state: "Waiting on you" });
	});
});

describe("buildNowCard: fix", () => {
	const verdict = (open: number): ObserverEvent => event({ kind: "qa_verdict", seq: 7, module: MODULE, verdict: "issues", open, ts: "2026-01-01T09:50:00.000Z" });

	it("is the red card for the Fix phase with its round, open issues and hint", () => {
		const status = statusOf({
			workFiles: [todoEntry({ open: 2, total: 5 })],
			running: [work({ sessionId: "s1", phase: "fix", qaFixRound: 2, elapsedMs: 65_000, startedAt: "2026-01-01T09:58:55.000Z" })],
		});
		const card = buildNowCard({ status, events: [verdict(2)], focus: "s1", now: NOW });
		expect(card).toEqual({
			kind: "fix",
			state: "QA → Fix · round 2",
			icon: "loop",
			title: "Fix",
			titleMono: null,
			sub: "2 of 5 issues open",
			parts: [
				{ label: "agent", value: "aide-implementor", mono: true },
				{ label: "module", value: MODULE, mono: true },
			],
			time: "1m 05s",
			timeLabel: `elapsed · round 2 started ${clock("2026-01-01T09:58:55.000Z")}`,
			steps: null,
			hint: "QA round 2 found 2 still open in todo.aide.",
			pipeline: null,
		});
	});

	it("is a fix card for QA from round 2, not for round 1", () => {
		const second = buildNowCard({ status: statusOf({ running: [work({ sessionId: "s1", phase: "qa", qaFixRound: 2 })] }), events: [], focus: "s1", now: NOW });
		expect(second).toMatchObject({ kind: "fix", title: "QA", state: "QA → Fix · round 2" });
	});

	it("omits the issue count and the hint when the todo and the verdict reported none", () => {
		const card = buildNowCard({ status: statusOf({ running: [work({ sessionId: "s1", phase: "fix", qaFixRound: 2 })] }), events: [event({ kind: "qa_verdict", seq: 3, module: MODULE, verdict: "issues" })], focus: "s1", now: NOW });
		expect(card).toMatchObject({ kind: "fix", sub: null, hint: null });
	});

	it("omits the round when none was reported", () => {
		const card = buildNowCard({ status: statusOf({ running: [work({ sessionId: "s1", phase: "fix" })] }), events: [verdict(1)], focus: "s1", now: NOW });
		expect(card).toMatchObject({ state: "QA → Fix", hint: null });
		expect(card.timeLabel).toMatch(/^elapsed · started /);
	});
});

describe("buildNowCard: idle", () => {
	const opening = event({ kind: "session_started", seq: 1 });
	const closed = [
		opening,
		event({ kind: "phase_started", seq: 2, phase: "qa", agent: "aide-qa", module: MODULE, ts: "2026-01-01T09:40:00.000Z" }),
		event({ kind: "phase_finished", seq: 3, phase: "qa", agent: "aide-qa", module: MODULE, ts: "2026-01-01T09:46:00.000Z" }),
		event({ kind: "qa_verdict", seq: 4, module: MODULE, verdict: "passed", ts: "2026-01-01T09:48:00.000Z" }),
	];

	it("is the quiet card once anything beyond the opening was recorded, worded as the history words the newest event", () => {
		const card = buildNowCard({ status: statusOf(), events: closed, focus: "s1", now: NOW });
		expect(card).toEqual({
			kind: "idle",
			state: "Idle — no events for 12m",
			icon: "idle",
			title: "Last: QA passed",
			titleMono: null,
			sub: null,
			parts: [
				{ label: "module", value: MODULE, mono: true },
				{ label: "agent", value: "aide-qa", mono: true },
			],
			time: "12m",
			timeLabel: "since last event",
			steps: null,
			hint: null,
			pipeline: null,
		});
	});

	it("puts a commit’s sha in the title’s mono part", () => {
		const events = [opening, event({ kind: "commit", seq: 2, sha: "414776fabc", message: "score: add weights", ts: "2026-01-01T09:48:00.000Z" })];
		expect(buildNowCard({ status: statusOf(), events, focus: "s1", now: NOW })).toMatchObject({ title: "Last: Commit", titleMono: "414776f" });
	});

	it("has no parts when no phase event is held", () => {
		const events = [opening, event({ kind: "commit", seq: 2, sha: "414776fabc" })];
		expect(buildNowCard({ status: statusOf(), events, focus: "s1", now: NOW }).parts).toEqual([]);
	});
});

describe("buildNowCard: empty", () => {
	it("is the dashed card when only the opening and prompts were recorded", () => {
		const events = [
			event({ kind: "session_started", seq: 1, sessionId: "s2", ts: "2026-01-01T09:00:00.000Z" }),
			event({ kind: "session_started", seq: 1, ts: "2026-01-01T09:30:00.000Z" }),
			event({ kind: "prompt", seq: 2, text: "go", ts: "2026-01-01T09:31:00.000Z" }),
		];
		const card = buildNowCard({ status: statusOf(), events, focus: "s1", now: NOW });
		expect(card).toEqual({
			kind: "empty",
			state: "No activity yet",
			icon: "clock",
			title: "Waiting for the first phase",
			titleMono: null,
			sub: null,
			parts: [{ label: "session started", value: clock("2026-01-01T09:30:00.000Z"), mono: true }],
			time: null,
			timeLabel: null,
			steps: null,
			hint: "The agent hasn’t started a phase. The rail and this card light up as soon as one begins.",
		});
	});

	it("is empty with no part when nothing at all was recorded", () => {
		expect(buildNowCard({ status: statusOf(), events: [], focus: null, now: NOW })).toMatchObject({ kind: "empty", parts: [], time: null });
	});
});
