import type { FixtureModule, FixturePlan } from "@/observer/seedFixtures/types/index.js";
import SCORE_CONTENT from "@/observer/seedFixtures/scenarios/shared/modules/scoreContent/index.js";

/** Step texts for a module whose plan the handoff only counts; the n-th step reads the n-th entry, wrapping. */
const GENERIC_STEPS = [
	"Define the module's types",
	"Implement the core operation",
	"Wire it into the parent orchestrator",
	"Cover it with tests",
	"Update the intent spec's references",
	"Review the public exports",
	"Run the full gate",
	"Document the change",
];

/**
 * Renders a module's `plan.aide`: frontmatter `status`, then `## Plan` with `plan.total` numbered `### N.`
 * steps, the first `plan.done` of them checked. A step has one checkbox, except `src/tools/score` step 2
 * whose 2a and 2b rows are its two checkboxes. The step counter reads a step as done when all its boxes are.
 */
export default function renderPlan({ module, plan }: { module: FixtureModule; plan: FixturePlan }): string {
	const isScore = module.path === "src/tools/score";

	const steps = Array.from({ length: plan.total }, (_, index) => {
		const number = index + 1;
		const mark = number <= plan.done ? "x" : " ";
		const step = isScore ? SCORE_CONTENT.planSteps[index] : undefined;
		const text = step?.text ?? GENERIC_STEPS[index % GENERIC_STEPS.length];
		const boxes = (step?.subs ?? [text]).map((line) => `- [${mark}] ${line}`);
		return [`### ${number}. ${text}`, "", ...boxes].join("\n");
	});

	const structure = [
		"## Project Structure",
		"",
		"```",
		`${module.path}/`,
		"├── .aide                 intent spec",
		"├── index.ts              orchestrator: run(input) => Result (existing)",
		"│                         first call: weigh → rank, kept for the rest of the run",
		"├── types/index.ts        shared types for this module (new)",
		"├── weigh/index.ts        weigh(node) => number (new)",
		"└── rank/index.ts         rank(nodes) => Node[] (new)   ← ranks every node by weight, then by open todo count, then by path, so the output order is stable across runs",
		"```",
		"",
		"| # | Helper | Steps | Notes |",
		"|---|--------|------:|-------|",
		"| 1 | `types` | 1 | Shared shapes, derived from `Node` |",
		"| 2 | `weigh` | 2 | Reads `weights.json`; **no** network calls |",
		"| 3 | `rank` | 1 | Stable sort |",
	].join("\n");
	const decisions = [
		"## Decisions",
		"",
		"- Weights live in one table so QA can golden-test them.",
		"- Ties break by open todo count, then path, so output is stable:",
		"  - open todo count, highest first;",
		"    - a module with no todo counts as zero;",
		"  - then the path, A to Z.",
		"  This order is the golden test's only input.",
		"- `rank` takes `Node[]` and never mutates it; see `src/tools/score/rank/index.ts`.",
	].join("\n");
	return [
		"---",
		`status: ${plan.status}`,
		"---",
		"",
		structure,
		"",
		"## Prerequisites",
		"",
		"- None beyond the existing module.",
		"",
		"## Plan",
		"",
		steps.join("\n\n"),
		"",
		decisions,
		"",
	].join("\n");
}
