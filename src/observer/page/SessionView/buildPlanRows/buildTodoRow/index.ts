import type { ModuleRow, PlanRowModel } from "@/observer/page/types/index.js";
import percentOf from "@/observer/page/SessionView/buildPlanRows/percentOf/index.js";

/** The row for a module's todo list: `<n> open` in danger, or `All closed`; progress counts what is closed. */
export default function buildTodoRow({ module, todo, current }: { module: ModuleRow; todo: NonNullable<ModuleRow["todo"]>; current: string | null }): PlanRowModel {
	const closed = todo.total - todo.open;
	const open = todo.open > 0;
	return {
		module: module.label,
		kind: "todo",
		status: open ? `${todo.open} open` : "All closed",
		tone: open ? "danger" : "done",
		icon: open ? "issues" : "done",
		progress: `${closed}/${todo.total} closed`,
		percent: percentOf({ part: closed, total: todo.total }),
		highlighted: module.folder === current,
		item: { kind: "file", path: todo.file },
	};
}
