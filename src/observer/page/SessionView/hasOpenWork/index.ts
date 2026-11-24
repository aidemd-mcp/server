import type { ModuleRow } from "@/observer/page/types/index.js";

/** True when the module's plan is proposed or approved, or its todo has open items. */
export default function hasOpenWork({ module }: { module: ModuleRow }): boolean {
	const planOpen = module.plan !== null && (module.plan.status === "proposed" || module.plan.status === "approved");
	return planOpen || (module.todo !== null && module.todo.open > 0);
}
