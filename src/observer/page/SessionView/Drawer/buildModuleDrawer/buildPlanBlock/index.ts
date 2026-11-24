import type { DrawerBlockModel, ModuleRow } from "@/observer/page/types/index.js";
import PLAN_STATUS_LOOK from "@/observer/page/SessionView/buildPlanRows/planStatusLook/index.js";
import parsePlanSteps from "@/observer/page/SessionView/Drawer/parsePlanSteps/index.js";

/**
 * The plan's checklist: its steps and sub-steps with the first open one marked current, and a badge
 * of the status and step count the tree reported (`approved · 3/9`; just the count while the plan
 * records no status). Null for a plan with no checkbox to list.
 */
export default function buildPlanBlock({ text, plan }: { text: string; plan: ModuleRow["plan"] }): DrawerBlockModel | null {
	const steps = parsePlanSteps(text);
	if (steps.length === 0) return null;
	const current = steps.findIndex((step) => !step.done);
	return {
		heading: "Plan",
		icon: "step",
		badge:
			plan === null
				? null
				: {
						text: plan.status === "unset" ? `${plan.done}/${plan.total}` : `${plan.status} · ${plan.done}/${plan.total}`,
						tone: (PLAN_STATUS_LOOK[plan.status] ?? PLAN_STATUS_LOOK.unset!).tone,
					},
		type: "check",
		items: steps.map((step, index) => ({ no: step.number ?? "", text: step.text, done: step.done, sub: step.sub, current: index === current })),
	};
}
