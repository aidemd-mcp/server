import type { ObserverEventInput } from "@/service/observer/event/shared/schema/index.js";
import type { FixtureEvent, TimelineCut } from "@/observer/seedFixtures/types/index.js";
import clockOffset from "@/observer/seedFixtures/scenarios/shared/clockOffset/index.js";
import handoffTasks from "@/observer/seedFixtures/scenarios/shared/handoffTasks/index.js";

/** The module the handoff's pipeline works on. */
const MODULE = "src/tools/score";

/** The clock time of the last event each cut keeps; the cut's events are those of its branch up to this time. */
const LAST_AT = {
	/** `s-no-events`: the session start and the prompt. */
	none: "14:02:10",
	/** `s-two-live`: Plan started. */
	plan: "14:15:36",
	/** `s-waiting`: the plan.aide approval gate is open. */
	wait: "14:19:20",
	/** `s-building`: the commit of Build step 3. */
	build: "14:31:32",
	/** `s-idle`: the release that follows QA passing. */
	idle: "14:51:20",
	/** `s-qa-fix`: Fix round 2 started. */
	fix: "14:50:20",
} as const satisfies Record<TimelineCut, string>;

/** One history row of the handoff, as the event that would have produced it, at its clock time. */
type Entry = { at: string; event: ObserverEventInput };

const GATE_APPROVE = "Approve plan.aide for src/tools/score (9 steps).";

/** The handoff's prompt; its first line is the history row's text and the whole text is the prompt drawer's. */
const FIRST_PROMPT =
	"Pick up the next p1 from the board and run the pipeline on it\n\nIf the spec for the module is misaligned, fix the spec first and stop at plan approval so I can read the plan. Keep commits small and reference the task slug.";

const TASK = handoffTasks.rank;

/** The handoff's drawer text for commit 414776f. */
const WEIGHTS_COMMIT =
	"score: add alignment weights\n\nAdds weights.ts with the misaligned/unreviewed/aligned ordering and\nexposes weight on tree nodes. Ranking not wired yet (step 4).\n\nTask: aide-score-misaligned-rank";

/** The handoff's error row; its first line is the row's text, the rest is the error drawer's message. */
const TIMEOUT_ERROR =
	"rank.test.ts timed out after 30s\n\nError: Test timed out in 30000ms.\n  at src/tools/score/rank.test.ts:118";

/**
 * The handoff's `historyData` up to the start of QA, in time order. The clock times keep the handoff's spacing
 * and are chosen so the phase durations the rail shows come out as its meta says: Spec 2m 10s, Research 6m 02s,
 * Synthesize 3m 18s, Plan 3m 41s, the approval wait 4m 12s and Build 18m 20s; the live build is 7m 51s old at
 * its last event. A file the handoff lists under a row follows that row, so the page folds it under it. The
 * handoff names no module for Synthesize; the event needs one, so it carries the pipeline's.
 */
const COMMON: Entry[] = [
	{ at: "14:02:00", event: { kind: "session_started" } },
	{ at: "14:02:10", event: { kind: "prompt", text: FIRST_PROMPT } },
	{ at: "14:03:11", event: { kind: "task", slug: TASK.slug, title: TASK.title, action: "picked", column: "In Progress" } },
	{ at: "14:03:26", event: { kind: "phase_started", phase: "spec", agent: "aide-spec-writer", module: MODULE } },
	{ at: "14:05:36", event: { kind: "phase_finished", phase: "spec", agent: "aide-spec-writer", module: MODULE } },
	{ at: "14:05:37", event: { kind: "file_written", path: `${MODULE}/.aide`, action: "updated" } },
	{ at: "14:05:38", event: { kind: "file_written", path: `${MODULE}/brief.aide`, action: "created" } },
	{ at: "14:05:51", event: { kind: "phase_started", phase: "research", agent: "aide-domain-expert", module: MODULE } },
	{ at: "14:11:53", event: { kind: "phase_finished", phase: "research", agent: "aide-domain-expert", module: MODULE } },
	{ at: "14:11:54", event: { kind: "file_written", path: `${MODULE}/research.aide`, action: "created" } },
	{ at: "14:12:06", event: { kind: "phase_started", phase: "synthesize", agent: "aide-strategist", module: MODULE } },
	{ at: "14:15:24", event: { kind: "phase_finished", phase: "synthesize", agent: "aide-strategist", module: MODULE } },
	{ at: "14:15:36", event: { kind: "phase_started", phase: "plan", agent: "aide-architect", module: MODULE } },
	{ at: "14:19:17", event: { kind: "phase_finished", phase: "plan", agent: "aide-architect", module: MODULE } },
	{ at: "14:19:18", event: { kind: "file_written", path: `${MODULE}/plan.aide`, action: "created" } },
	{ at: "14:19:20", event: { kind: "gate_waiting", gate: GATE_APPROVE, file: `${MODULE}/plan.aide` } },
	{
		at: "14:23:32",
		event: { kind: "gate_resolved", gate: GATE_APPROVE, file: `${MODULE}/plan.aide`, resolution: "approved" },
	},
	{ at: "14:23:41", event: { kind: "phase_started", phase: "build", agent: "aide-implementor", module: MODULE } },
	{ at: "14:25:41", event: { kind: "plan_step_checked", module: MODULE, step: "1", total: 9 } },
	{ at: "14:27:16", event: { kind: "plan_step_checked", module: MODULE, step: "2", total: 9 } },
	{ at: "14:27:17", event: { kind: "file_written", path: `${MODULE}/weights.ts`, action: "created" } },
	{ at: "14:27:18", event: { kind: "file_written", path: `${MODULE}/rank.ts`, action: "updated" } },
	{ at: "14:27:19", event: { kind: "file_written", path: `${MODULE}/rank.test.ts`, action: "updated" } },
	{ at: "14:29:21", event: { kind: "plan_step_checked", module: MODULE, step: "3", total: 9 } },
	{ at: "14:31:32", event: { kind: "commit", sha: "414776f", message: WEIGHTS_COMMIT } },
	{ at: "14:40:50", event: { kind: "plan_step_checked", module: MODULE, step: "9", total: 9 } },
	{ at: "14:42:01", event: { kind: "phase_finished", phase: "build", agent: "aide-implementor", module: MODULE } },
	{ at: "14:42:05", event: { kind: "phase_started", phase: "qa", agent: "aide-qa", module: MODULE } },
];

/**
 * The handoff's `idle` history after QA started: QA passed (2m 48s later), commit, move to In Review, release.
 * The QA phase is closed right after its verdict, because the observer reads a phase with no finish as still
 * running, which would make the idle session show QA running; that finish is the one row here the handoff
 * does not list.
 */
const IDLE_TAIL: Entry[] = [
	{ at: "14:44:53", event: { kind: "qa_verdict", module: MODULE, verdict: "passed", open: 0 } },
	{ at: "14:44:54", event: { kind: "phase_finished", phase: "qa", agent: "aide-qa", module: MODULE } },
	{ at: "14:45:20", event: { kind: "commit", sha: "9c1e2ab", message: "score: rank misaligned below unreviewed" } },
	{ at: "14:50:20", event: { kind: "task", slug: TASK.slug, title: TASK.title, action: "moved", column: "In Review" } },
	{ at: "14:51:20", event: { kind: "release", version: "v0.9.2" } },
];

/** The handoff's `fix` history after QA started: 5 issues, Fix round 1 (3m 50s), the timeout, 2 issues, Fix round 2. */
const FIX_TAIL: Entry[] = [
	{ at: "14:44:10", event: { kind: "qa_verdict", module: MODULE, verdict: "issues", open: 5 } },
	{ at: "14:44:11", event: { kind: "phase_started", phase: "fix", agent: "aide-implementor", module: MODULE } },
	{
		at: "14:48:01",
		event: { kind: "phase_finished", phase: "fix", agent: "aide-implementor", module: MODULE, result: "3 issues closed" },
	},
	{ at: "14:48:02", event: { kind: "file_written", path: `${MODULE}/rank.ts`, action: "updated" } },
	{ at: "14:48:03", event: { kind: "file_written", path: `${MODULE}/todo.aide`, action: "updated" } },
	{ at: "14:48:50", event: { kind: "error", message: TIMEOUT_ERROR, agent: "aide-qa", module: MODULE } },
	{ at: "14:49:40", event: { kind: "qa_verdict", module: MODULE, verdict: "issues", open: 2 } },
	{ at: "14:50:20", event: { kind: "phase_started", phase: "fix", agent: "aide-implementor", module: MODULE } },
];

/** The entries each cut draws from: the common history, plus the tail of the branch QA took. */
const BRANCH: Record<TimelineCut, Entry[]> = {
	none: COMMON,
	plan: COMMON,
	wait: COMMON,
	build: COMMON,
	idle: [...COMMON, ...IDLE_TAIL],
	fix: [...COMMON, ...FIX_TAIL],
};

/**
 * The handoff's main session as fixture events, cut at the named point and aged so the cut's last event
 * happened `lastAgoMin` minutes ago, with every earlier event spaced as the handoff's clock spaces it. The
 * first event is `session_started`; the writer fills its root, tag and brain folder. The handoff's `Done`
 * row is not an event and is left out.
 */
export default function timeline({ through, lastAgoMin }: { through: TimelineCut; lastAgoMin: number }): FixtureEvent[] {
	const anchor = LAST_AT[through];
	return BRANCH[through]
		.filter((entry) => entry.at <= anchor)
		.map(({ at, event }) => ({
			offsetMin: clockOffset({ at, anchor, anchorAgoMin: lastAgoMin }),
			...event,
		}));
}
