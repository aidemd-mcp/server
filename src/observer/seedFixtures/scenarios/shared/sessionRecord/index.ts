import type { SessionRecordVariant } from "@/observer/seedFixtures/types/index.js";

/** The handoff's record sections that change with the scenario (`R` in its `renderVals`). */
type Content = {
	stopped: string;
	next: string[];
	questions: string[];
};

const BUILD: Content = {
	stopped:
		"Build is on step 4 of 9 for src/tools/score: weights.ts exists and nodes carry a weight, but aide_score doesn’t use it yet.",
	next: [
		"Finish step 4: sort by weight inside aide_score.",
		"Do step 5: break ties by open todo count, then by path.",
		"Run the golden test against test/fixtures before QA.",
		"Move aide-score-misaligned-rank to In Review once QA passes.",
	],
	questions: [],
};

/** The handoff draws the build record for every scenario that is not fix, idle or no-events (`rk` in its `renderVals`). */
const CONTENT: Record<SessionRecordVariant, Content> = {
	building: BUILD,
	waiting: BUILD,
	idle: {
		stopped:
			"The cycle finished: QA passed for src/tools/score, commit 9c1e2ab, task moved to In Review, release v0.9.2 tagged.",
		next: ["Pick aide-validate-path-scope (p1 bug) from Todo.", "Re-review src/tools/validate — it’s marked misaligned."],
		questions: [
			"Is v0.9.2 the right version, or should ranking changes be a minor bump?",
			"Keep the modified-time sort behind a flag for one release?",
		],
	},
	noEvents: {
		stopped: "This cycle hasn’t started a phase yet.",
		next: ["Pick a task from the board."],
		questions: [],
	},
	qaFix: {
		stopped: "QA round 2 left 2 of 5 issues open in src/tools/score/todo.aide; Fix round 2 is running.",
		next: [
			"Close rank.ts:42 — tie-break by path.",
			"Add the misaligned-leaf case at rank.test.ts:118.",
			"Re-run QA (round 3).",
			"If QA passes, move the task to In Review and write the retro.",
		],
		questions: ["Should unreviewed modules with open todos outrank aligned ones with more open todos?"],
	},
};

const STATE_SUMMARY =
	"aidemd-mcp v0.9.1. Pipeline events, install and the viewer server are in place; aide_score ordering is being reworked. 14 modules, 1 misaligned (src/tools/validate).";

/** The handoff's Kanban section, which names the three tasks it shows (the first is the one the board marks as this session's). */
const KANBAN = [
	"- **In Progress:** `aide-score-misaligned-rank` — aide_score ranks misaligned specs below unreviewed ones (p1, bug)",
	"- **In Review:** `viewer-reconnect` — Viewer reconnects after a server restart (p1, feature)",
	"- **Next up:** `aide-validate-path-scope` (p1, bug)",
].join("\n");

/** The handoff's decisions D1, D2, D4 and D7, with the numbers it shows as retired between them. */
const INTENT = [
	"- **D1** Pipeline events are append-only, one JSONL file per session; nothing rewrites history except deleting a whole ended session.",
	"- **D2** The viewer is read-only. Approvals happen in the agent session, never in the page.",
	"",
	"*D3 retired*",
	"",
	"- **D4** The intent tree is read from the filesystem (`.aide` files), not reconstructed from events.",
	"",
	"*D5–D6 retired*",
	"",
	"- **D7** **aide_score** orders misaligned before unreviewed before aligned, then by open todo count.",
].join("\n");

const INVARIANTS = [
	"- `aide_validate` with a path only reports specs under that path.",
	"- Install never overwrites an existing `.aide/intent.aide`.",
	"- Event writer tolerates a brain folder path with spaces.",
	"- Plan step numbering keeps sub-steps (2a, 2b) attached to their parent.",
].join("\n");

/**
 * Renders the handoff's session record as a real `.aide/session.aide`: frontmatter `intent`, then the sections
 * the page draws in its order — Where this cycle stopped (with "What the next agent must do" as its
 * subsection), State summary, Kanban, Architectural intent, Anti-regression invariants and Open questions (no
 * text at all when the variant has none, so the page shows its empty-section line). Everything but the
 * stopped text, the next steps and the open questions is the same in every variant, as in the handoff.
 */
export default function sessionRecord({ variant }: { variant: SessionRecordVariant }): string {
	const content = CONTENT[variant];

	return [
		"---",
		"intent: >",
		"  Session record for the aidemd-mcp server: the pipeline state a cold-start agent resumes from.",
		"---",
		"",
		"# AIDE SESSION",
		"",
		"## Where this cycle stopped",
		"",
		content.stopped,
		"",
		"### What the next agent must do",
		"",
		content.next.map((line, index) => `${index + 1}. ${line}`).join("\n"),
		"",
		"## State summary",
		"",
		STATE_SUMMARY,
		"",
		"## Kanban",
		"",
		KANBAN,
		"",
		"## Architectural intent",
		"",
		INTENT,
		"",
		"## Anti-regression invariants",
		"",
		INVARIANTS,
		"",
		"## Open questions",
		"",
		...(content.questions.length === 0 ? [] : [content.questions.map((line) => `- ${line}`).join("\n"), ""]),
	].join("\n");
}
