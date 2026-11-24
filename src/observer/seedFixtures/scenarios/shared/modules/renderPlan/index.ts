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

	return ["---", `status: ${plan.status}`, "---", "", "## Plan", "", steps.join("\n\n"), ""].join("\n");
}
