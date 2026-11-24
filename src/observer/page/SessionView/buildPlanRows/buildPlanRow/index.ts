import type { ModuleRow, PlanRowModel } from "@/observer/page/types/index.js";
import percentOf from "@/observer/page/SessionView/buildPlanRows/percentOf/index.js";
import PLAN_STATUS_LOOK from "@/observer/page/SessionView/buildPlanRows/planStatusLook/index.js";

/** The row for a module's plan: its status badge, `<done>/<total> steps`, and the plan file as the drawer item. */
export default function buildPlanRow({ module, plan, current }: { module: ModuleRow; plan: NonNullable<ModuleRow["plan"]>; current: string | null }): PlanRowModel {
	const look = PLAN_STATUS_LOOK[plan.status] ?? PLAN_STATUS_LOOK.unset!;
	return {
		module: module.label,
		kind: "plan",
		status: look.word,
		tone: look.tone,
		icon: look.icon,
		progress: `${plan.done}/${plan.total} steps`,
		percent: percentOf({ part: plan.done, total: plan.total }),
		highlighted: module.folder === current,
		item: { kind: "file", path: plan.file },
	};
}
