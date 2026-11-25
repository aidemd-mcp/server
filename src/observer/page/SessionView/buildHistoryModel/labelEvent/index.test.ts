import { describe, expect, it } from "vitest";
import type { ObserverEvent } from "@/types/index.js";
import labelEvent from "./index.js";

const ROOT = "/work/aidemd-mcp";
const MODULE = "src/tools/score";

function at(clock: string): string {
	return `2026-01-01T${clock}.000Z`;
}

function event(fields: Record<string, unknown> & { kind: ObserverEvent["kind"]; seq: number }): ObserverEvent {
	return { v: 1, ts: at("14:00:00"), sessionId: "s1", pid: 1, ...fields } as ObserverEvent;
}

/**
 * The handoff's `historyData` rows (design_reference/Viewer.dc.html), one per label rule: the events
 * that produce each, and the exact label, mono and meta strings the prototype prints. The prototype's
 * `Synthesize started` row omits the module, which the event schema requires, so it is not drawn here.
 */
const HISTORY: { name: string; events: ObserverEvent[]; at: number; expected: { label: string; mono: string | null; meta: string | null } }[] = [
	{
		name: "session started",
		events: [event({ kind: "session_started", seq: 1, projectRoot: "~/code/aidemd-mcp", kanbanTag: "aidemd" })],
		at: 0,
		expected: { label: "Session started", mono: null, meta: "~/code/aidemd-mcp · kanban aidemd" },
	},
	{
		name: "prompt",
		events: [event({ kind: "prompt", seq: 2, text: "Pick up the next p1 from the board and run the pipeline on it" })],
		at: 0,
		expected: { label: "Prompt: “Pick up the next p1 from the board and run the pipeline on it”", mono: null, meta: null },
	},
	{
		name: "task picked, with the column it came from",
		events: [
			event({ kind: "task", seq: 3, slug: "aide-score-misaligned-rank", action: "moved", column: "Todo", ts: at("13:00:00") }),
			event({ kind: "task", seq: 4, slug: "aide-score-misaligned-rank", action: "picked", column: "In Progress" }),
		],
		at: 1,
		expected: { label: "Picked task", mono: "aide-score-misaligned-rank", meta: "Todo → In Progress" },
	},
	{
		name: "task moved",
		events: [
			event({ kind: "task", seq: 5, slug: "aide-score-misaligned-rank", action: "picked", column: "In Progress", ts: at("13:00:00") }),
			event({ kind: "task", seq: 6, slug: "aide-score-misaligned-rank", action: "moved", column: "In Review" }),
		],
		at: 1,
		expected: { label: "Moved task", mono: "aide-score-misaligned-rank", meta: "In Progress → In Review" },
	},
	{
		name: "spec started",
		events: [event({ kind: "phase_started", seq: 7, phase: "spec", agent: "aide-spec-writer", module: MODULE })],
		at: 0,
		expected: { label: "Spec started", mono: null, meta: "aide-spec-writer · src/tools/score" },
	},
	{
		name: "spec finished with its duration",
		events: [
			event({ kind: "phase_started", seq: 8, phase: "spec", agent: "aide-spec-writer", module: MODULE, ts: at("14:03:00") }),
			event({ kind: "phase_finished", seq: 9, phase: "spec", agent: "aide-spec-writer", module: MODULE, ts: at("14:05:10") }),
		],
		at: 1,
		expected: { label: "Spec finished · 2m 10s", mono: null, meta: null },
	},
	{
		name: "research finished (seconds zero-padded)",
		events: [
			event({ kind: "phase_started", seq: 10, phase: "research", agent: "aide-domain-expert", module: MODULE, ts: at("14:05:00") }),
			event({ kind: "phase_finished", seq: 11, phase: "research", agent: "aide-domain-expert", module: MODULE, ts: at("14:11:02") }),
		],
		at: 1,
		expected: { label: "Research finished · 6m 02s", mono: null, meta: null },
	},
	{
		name: "synthesize finished",
		events: [
			event({ kind: "phase_started", seq: 12, phase: "synthesize", agent: "aide-strategist", module: MODULE, ts: at("14:11:00") }),
			event({ kind: "phase_finished", seq: 13, phase: "synthesize", agent: "aide-strategist", module: MODULE, ts: at("14:14:18") }),
		],
		at: 1,
		expected: { label: "Synthesize finished · 3m 18s", mono: null, meta: null },
	},
	{
		name: "plan started",
		events: [event({ kind: "phase_started", seq: 14, phase: "plan", agent: "aide-architect", module: MODULE })],
		at: 0,
		expected: { label: "Plan started", mono: null, meta: "aide-architect · src/tools/score" },
	},
	{
		name: "plan finished",
		events: [
			event({ kind: "phase_started", seq: 15, phase: "plan", agent: "aide-architect", module: MODULE, ts: at("14:14:00") }),
			event({ kind: "phase_finished", seq: 16, phase: "plan", agent: "aide-architect", module: MODULE, ts: at("14:17:41") }),
		],
		at: 1,
		expected: { label: "Plan finished · 3m 41s", mono: null, meta: null },
	},
	{
		name: "waiting on you",
		events: [event({ kind: "gate_waiting", seq: 17, gate: "approve", file: `${MODULE}/plan.aide` })],
		at: 0,
		expected: { label: "Waiting on you — approve", mono: "plan.aide", meta: "src/tools/score" },
	},
	{
		name: "approved, with how long it waited",
		events: [
			event({ kind: "gate_waiting", seq: 18, gate: "approve", file: `${MODULE}/plan.aide`, ts: at("14:18:00") }),
			event({ kind: "gate_resolved", seq: 19, gate: "approve", file: `${MODULE}/plan.aide`, ts: at("14:22:12") }),
		],
		at: 1,
		expected: { label: "Approved", mono: "plan.aide", meta: "waited 4m 12s" },
	},
	{
		name: "build started",
		events: [event({ kind: "phase_started", seq: 20, phase: "build", agent: "aide-implementor", module: MODULE })],
		at: 0,
		expected: { label: "Build started", mono: null, meta: "aide-implementor · src/tools/score" },
	},
	{
		name: "plan step checked",
		events: [event({ kind: "plan_step_checked", seq: 21, module: MODULE, step: "1", total: 9 })],
		at: 0,
		expected: { label: "Plan step checked · 1/9", mono: null, meta: "src/tools/score" },
	},
	{
		name: "commit",
		events: [event({ kind: "commit", seq: 22, sha: "414776fabcdef", message: "score: add alignment weights\n\nbody line" })],
		at: 0,
		expected: { label: "Commit", mono: "414776f", meta: "score: add alignment weights" },
	},
	{
		name: "build finished",
		events: [
			event({ kind: "phase_started", seq: 23, phase: "build", agent: "aide-implementor", module: MODULE, ts: at("14:22:00") }),
			event({ kind: "phase_finished", seq: 24, phase: "build", agent: "aide-implementor", module: MODULE, ts: at("14:40:20") }),
		],
		at: 1,
		expected: { label: "Build finished · 18m 20s", mono: null, meta: null },
	},
	{
		name: "qa started",
		events: [event({ kind: "phase_started", seq: 25, phase: "qa", agent: "aide-qa", module: MODULE })],
		at: 0,
		expected: { label: "QA started", mono: null, meta: "aide-qa · src/tools/score" },
	},
	{
		name: "qa passed",
		events: [event({ kind: "qa_verdict", seq: 26, module: MODULE, verdict: "passed", open: 0 })],
		at: 0,
		expected: { label: "QA passed", mono: null, meta: "src/tools/score · 0 open" },
	},
	{
		name: "release",
		events: [event({ kind: "release", seq: 27, version: "v0.9.2" })],
		at: 0,
		expected: { label: "Release", mono: "v0.9.2", meta: null },
	},
	{
		name: "qa found issues, round 1",
		events: [event({ kind: "qa_verdict", seq: 28, module: MODULE, verdict: "issues", open: 5, ts: at("14:42:00") })],
		at: 0,
		expected: { label: "QA found 5 issues", mono: null, meta: "src/tools/score · 5 open · round 1" },
	},
	{
		name: "fix started, round 1",
		events: [
			event({ kind: "qa_verdict", seq: 28, module: MODULE, verdict: "issues", open: 5, ts: at("14:42:00") }),
			event({ kind: "phase_started", seq: 29, phase: "fix", agent: "aide-implementor", module: MODULE, ts: at("14:42:30") }),
		],
		at: 1,
		expected: { label: "Fix started · round 1", mono: null, meta: "aide-implementor · src/tools/score" },
	},
	{
		name: "fix finished, with its summary as meta",
		events: [
			event({ kind: "phase_started", seq: 30, phase: "fix", agent: "aide-implementor", module: MODULE, ts: at("14:42:30") }),
			event({ kind: "phase_finished", seq: 31, phase: "fix", agent: "aide-implementor", module: MODULE, ts: at("14:46:20"), summary: "3 issues closed" }),
		],
		at: 1,
		expected: { label: "Fix finished · 3m 50s", mono: null, meta: "3 issues closed" },
	},
	{
		name: "error",
		events: [event({ kind: "error", seq: 32, message: "rank.test.ts timed out after 30s", agent: "aide-qa", module: MODULE })],
		at: 0,
		expected: { label: "Error: rank.test.ts timed out after 30s", mono: null, meta: "aide-qa · src/tools/score" },
	},
	{
		name: "qa found issues, round 2",
		events: [
			event({ kind: "qa_verdict", seq: 33, module: MODULE, verdict: "issues", open: 5, ts: at("14:42:00") }),
			event({ kind: "qa_verdict", seq: 34, module: MODULE, verdict: "issues", open: 2, ts: at("14:48:00") }),
		],
		at: 1,
		expected: { label: "QA found 2 issues", mono: null, meta: "src/tools/score · 2 open · round 2" },
	},
	{
		name: "fix started, round 2",
		events: [
			event({ kind: "qa_verdict", seq: 35, module: MODULE, verdict: "issues", open: 5, ts: at("14:42:00") }),
			event({ kind: "qa_verdict", seq: 36, module: MODULE, verdict: "issues", open: 2, ts: at("14:48:00") }),
			event({ kind: "phase_started", seq: 37, phase: "fix", agent: "aide-implementor", module: MODULE, ts: at("14:49:00") }),
		],
		at: 2,
		expected: { label: "Fix started · round 2", mono: null, meta: "aide-implementor · src/tools/score" },
	},
];

describe("labelEvent against the handoff's historyData", () => {
	it.each(HISTORY)("words $name exactly as the prototype does", ({ events, at: index, expected }) => {
		const target = events[index]!;
		const { label, mono, meta } = labelEvent({ event: target, events, projectRoot: ROOT });
		expect({ label, mono, meta }).toEqual(expected);
	});
});

/** The pipeline events' wording, which the handoff's prototype does not draw: the copy the user approved. */
const PIPELINE: typeof HISTORY = [
	{
		name: "pipeline started",
		events: [event({ kind: "pipeline_started", seq: 20, pipeline: "p1", phase: "spec" })],
		at: 0,
		expected: { label: "Pipeline p1 started at Spec", mono: null, meta: null },
	},
	{
		name: "pipeline completed",
		events: [event({ kind: "pipeline_finished", seq: 21, pipeline: "p1", result: "completed" })],
		at: 0,
		expected: { label: "Pipeline p1 completed", mono: null, meta: null },
	},
	{
		name: "pipeline abandoned",
		events: [event({ kind: "pipeline_finished", seq: 22, pipeline: "p1", result: "abandoned" })],
		at: 0,
		expected: { label: "Pipeline p1 abandoned", mono: null, meta: null },
	},
	{
		name: "phase skipped, with its reason as meta",
		events: [event({ kind: "phase_skipped", seq: 23, pipeline: "p1", phase: "research", reason: "brain already covers it" })],
		at: 0,
		expected: { label: "Research skipped", mono: null, meta: "brain already covers it" },
	},
];

describe("labelEvent for pipeline events", () => {
	it.each(PIPELINE)("words $name", ({ events, at: index, expected }) => {
		const target = events[index]!;
		const { label, mono, meta } = labelEvent({ event: target, events, projectRoot: ROOT });
		expect({ label, mono, meta }).toEqual(expected);
	});
});

describe("labelEvent: kind and drawer item", () => {
	it.each([
		["session_started", { kind: "session_started", seq: 1 }, "start", { kind: "event", sessionId: "s1", seq: 1 }],
		["prompt", { kind: "prompt", seq: 2, text: "go" }, "prompt", { kind: "event", sessionId: "s1", seq: 2 }],
		["task", { kind: "task", seq: 3, slug: "t-1", action: "picked" }, "task", { kind: "task", slug: "t-1" }],
		["phase_started", { kind: "phase_started", seq: 4, phase: "plan", agent: "a", module: `${ROOT}/src/x` }, "phase", { kind: "module", folder: "src/x" }],
		["phase_finished", { kind: "phase_finished", seq: 5, phase: "plan", agent: "a", module: "m" }, "done", { kind: "event", sessionId: "s1", seq: 5 }],
		["gate_waiting", { kind: "gate_waiting", seq: 6, gate: "approve", file: `${ROOT}/m/plan.aide` }, "wait", { kind: "file", path: "m/plan.aide" }],
		["gate_resolved", { kind: "gate_resolved", seq: 7, gate: "approve", file: "m/plan.aide" }, "approve", { kind: "file", path: "m/plan.aide" }],
		["plan_step_checked", { kind: "plan_step_checked", seq: 8, module: "m", step: "2a" }, "step", { kind: "module", folder: "m" }],
		["qa issues", { kind: "qa_verdict", seq: 9, module: "m", verdict: "issues" }, "issues", { kind: "event", sessionId: "s1", seq: 9 }],
		["qa passed", { kind: "qa_verdict", seq: 10, module: "m", verdict: "passed" }, "pass", { kind: "event", sessionId: "s1", seq: 10 }],
		["file_written", { kind: "file_written", seq: 11, path: "src/a.ts", action: "created" }, "sub", { kind: "file", path: "src/a.ts" }],
		["commit", { kind: "commit", seq: 12, sha: "abcdef1" }, "commit", { kind: "event", sessionId: "s1", seq: 12 }],
		["release", { kind: "release", seq: 13, version: "1.0.0" }, "release", { kind: "event", sessionId: "s1", seq: 13 }],
		["pipeline_started", { kind: "pipeline_started", seq: 15, pipeline: "p1", phase: "spec" }, "pipeline", { kind: "event", sessionId: "s1", seq: 15 }],
		["pipeline_finished", { kind: "pipeline_finished", seq: 16, pipeline: "p1", result: "completed" }, "pipeline", { kind: "event", sessionId: "s1", seq: 16 }],
		["phase_skipped", { kind: "phase_skipped", seq: 17, pipeline: "p1", phase: "research", reason: "r" }, "skip", { kind: "event", sessionId: "s1", seq: 17 }],
		["error", { kind: "error", seq: 14, message: "boom" }, "error", { kind: "event", sessionId: "s1", seq: 14 }],
	] as const)("gives %s its kind and what a click opens", (_name, fields, kind, target) => {
		const subject = event({ ...fields });
		expect(labelEvent({ event: subject, events: [subject], projectRoot: ROOT })).toMatchObject({ kind, target });
	});
});

describe("labelEvent: what no event reported stays out", () => {
	it("prints a move with no known from-column as `→ <to>`, and with no column at all as no meta", () => {
		const withColumn = event({ kind: "task", seq: 1, slug: "t", action: "moved", column: "Done" });
		const withoutColumn = event({ kind: "task", seq: 2, slug: "t", action: "moved" });
		expect(labelEvent({ event: withColumn, events: [withColumn], projectRoot: ROOT }).meta).toBe("→ Done");
		expect(labelEvent({ event: withoutColumn, events: [withoutColumn], projectRoot: ROOT }).meta).toBeNull();
	});

	it("takes the from-column from the newest earlier event of the slug, across sessions, and not from a later one", () => {
		const events = [
			event({ kind: "task", seq: 1, slug: "t", action: "picked", column: "Todo", ts: at("10:00:00"), sessionId: "s2" }),
			event({ kind: "task", seq: 2, slug: "t", action: "moved", column: "In Progress", ts: at("11:00:00") }),
			event({ kind: "task", seq: 3, slug: "t", action: "moved", column: "In Review", ts: at("12:00:00") }),
			event({ kind: "task", seq: 4, slug: "other", action: "moved", column: "Backlog", ts: at("11:30:00") }),
		];
		expect(labelEvent({ event: events[1]!, events, projectRoot: ROOT }).meta).toBe("Todo → In Progress");
		expect(labelEvent({ event: events[2]!, events, projectRoot: ROOT }).meta).toBe("In Progress → In Review");
	});

	it("leaves the duration off a finished phase whose start is not held, and the waited span off an approval whose wait is not held", () => {
		const finished = event({ kind: "phase_finished", seq: 1, phase: "plan", agent: "a", module: "m" });
		const approved = event({ kind: "gate_resolved", seq: 2, gate: "approve", file: "m/plan.aide" });
		expect(labelEvent({ event: finished, events: [finished], projectRoot: ROOT }).label).toBe("Plan finished");
		expect(labelEvent({ event: approved, events: [approved], projectRoot: ROOT }).meta).toBeNull();
	});

	it("uses the result as meta when a finished phase has no summary, and the summary's first line when it has both", () => {
		const resultOnly = event({ kind: "phase_finished", seq: 1, phase: "qa", agent: "a", module: "m", result: "passed" });
		const both = event({ kind: "phase_finished", seq: 2, phase: "qa", agent: "a", module: "m", result: "passed", summary: "First line\nsecond line" });
		expect(labelEvent({ event: resultOnly, events: [resultOnly], projectRoot: ROOT }).meta).toBe("passed");
		expect(labelEvent({ event: both, events: [both], projectRoot: ROOT }).meta).toBe("First line");
	});

	it("words a resolution other than approved as `Resolved (<resolution>)`", () => {
		const rejected = event({ kind: "gate_resolved", seq: 1, gate: "approve", file: "m/plan.aide", resolution: "rejected" });
		const approved = event({ kind: "gate_resolved", seq: 2, gate: "approve", file: "m/plan.aide", resolution: "Approved" });
		expect(labelEvent({ event: rejected, events: [rejected], projectRoot: ROOT }).label).toBe("Resolved (rejected)");
		expect(labelEvent({ event: approved, events: [approved], projectRoot: ROOT }).label).toBe("Approved");
	});

	it("drops the total from a plan step, the open count from a QA verdict and the agent or module from an error when unreported", () => {
		const step = event({ kind: "plan_step_checked", seq: 1, module: "m", step: "4" });
		const verdict = event({ kind: "qa_verdict", seq: 2, module: "m", verdict: "issues" });
		const failure = event({ kind: "error", seq: 3, message: "boom" });
		const partial = event({ kind: "error", seq: 4, message: "boom", module: "m" });
		expect(labelEvent({ event: step, events: [step], projectRoot: ROOT }).label).toBe("Plan step checked · 4");
		expect(labelEvent({ event: verdict, events: [verdict], projectRoot: ROOT })).toMatchObject({ label: "QA found issues", meta: "m · round 1" });
		expect(labelEvent({ event: failure, events: [failure], projectRoot: ROOT }).meta).toBeNull();
		expect(labelEvent({ event: partial, events: [partial], projectRoot: ROOT }).meta).toBe("m");
	});

	it("words a single issue in the singular", () => {
		const verdict = event({ kind: "qa_verdict", seq: 1, module: "m", verdict: "issues", open: 1 });
		expect(labelEvent({ event: verdict, events: [verdict], projectRoot: ROOT }).label).toBe("QA found 1 issue");
	});

	it("shows only the reported part of the session opening, and words a long prompt by its first line", () => {
		const bare = event({ kind: "session_started", seq: 1 });
		const tagOnly = event({ kind: "session_started", seq: 2, kanbanTag: "aidemd" });
		const long = event({ kind: "prompt", seq: 3, text: "\n  First line  \nsecond line" });
		expect(labelEvent({ event: bare, events: [bare], projectRoot: ROOT }).meta).toBeNull();
		expect(labelEvent({ event: tagOnly, events: [tagOnly], projectRoot: ROOT }).meta).toBe("kanban aidemd");
		expect(labelEvent({ event: long, events: [long], projectRoot: ROOT }).label).toBe("Prompt: “First line”");
	});

	it("shows the root module of a gate as `.`", () => {
		const gate = event({ kind: "gate_waiting", seq: 1, gate: "approve", file: ".aide/plan.aide" });
		expect(labelEvent({ event: gate, events: [gate], projectRoot: ROOT })).toMatchObject({ mono: "plan.aide", meta: "." });
	});
});
