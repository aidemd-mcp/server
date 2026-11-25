import type { TreeEntry } from "@/observer/page/types/index.js";

/** Whether a node passes the tree's filters: its full path holds the query (any case), and every toggle that is on holds (open work, misaligned, has a plan, has a todo). */
export default function matchesFilters({
	entry,
	query,
	onlyOpen,
	onlyMisaligned,
	onlyPlans,
	onlyTodos,
}: {
	entry: TreeEntry;
	query: string;
	onlyOpen: boolean;
	onlyMisaligned: boolean;
	onlyPlans: boolean;
	onlyTodos: boolean;
}): boolean {
	if (onlyOpen && !entry.openWork) return false;
	if (onlyMisaligned && !entry.misaligned) return false;
	if (onlyPlans && !entry.chips.some((chip) => chip.kind === "plan")) return false;
	if (onlyTodos && !entry.chips.some((chip) => chip.kind === "todo")) return false;
	return query === "" || entry.path.toLowerCase().includes(query);
}
