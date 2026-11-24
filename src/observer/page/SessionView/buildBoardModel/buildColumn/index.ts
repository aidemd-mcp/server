import type { BoardColumn } from "@/types/index.js";
import type { BoardColumnModel } from "@/observer/page/types/index.js";
import buildTaskCard from "@/observer/page/SessionView/buildBoardModel/buildTaskCard/index.js";
import compareRecent from "@/observer/page/SessionView/buildBoardModel/compareRecent/index.js";

/** How many tasks the Done column shows before `Show all`. */
const DONE_CAP = 5;

/** How many tasks every other column shows before `Show all`. */
const COLUMN_CAP = 8;

/**
 * One column as the board draws it: every task as a card, in the observer's order except Done,
 * which is newest `updated` first, with the cap that decides how many show before `Show all`.
 * A task is linked when the session record names it or the focused session picked or moved it.
 */
export default function buildColumn({ column, linkedSlugs }: { column: BoardColumn; linkedSlugs: ReadonlySet<string> }): BoardColumnModel {
	const done = column.id === "done";
	const ordered = done ? [...column.tasks].sort(compareRecent) : column.tasks;
	return {
		id: column.id,
		name: column.label,
		total: column.tasks.length,
		tasks: ordered.map((task) => buildTaskCard({ task, linked: task.inSession || linkedSlugs.has(task.slug) })),
		cap: done ? DONE_CAP : COLUMN_CAP,
	};
}
