import type { ModuleRow, PlanRowModel } from "@/observer/page/types/index.js";
import buildPlanRow from "./buildPlanRow/index.js";
import buildTodoRow from "./buildTodoRow/index.js";

/**
 * The plans and todos table's rows: one per plan and one per todo the observer read, modules in tree
 * order (the root first, then by folder), a module's plan before its todo, the current module's rows
 * highlighted. Status and progress are exactly what the observer reported for each file.
 */
export default function buildPlanRows({ modules, current }: { modules: ModuleRow[]; current: string | null }): PlanRowModel[] {
	const rows: PlanRowModel[] = [];
	for (const module of modules) {
		if (module.plan !== null) rows.push(buildPlanRow({ module, plan: module.plan, current }));
		if (module.todo !== null) rows.push(buildTodoRow({ module, todo: module.todo, current }));
	}
	return rows;
}
