import type { TreeEntry } from "@/observer/page/types/index.js";

/** Whether a node passes the tree's filters: its full path holds the query (any case), and the open-work and misaligned toggles that are on both hold. */
export default function matchesFilters({
	entry,
	query,
	onlyOpen,
	onlyMisaligned,
}: {
	entry: TreeEntry;
	query: string;
	onlyOpen: boolean;
	onlyMisaligned: boolean;
}): boolean {
	if (onlyOpen && !entry.openWork) return false;
	if (onlyMisaligned && !entry.misaligned) return false;
	return query === "" || entry.path.toLowerCase().includes(query);
}
