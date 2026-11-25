import type { TreeData, TreeNodeModel } from "@/observer/page/types/index.js";
import buildCountLine from "./buildCountLine/index.js";
import matchesFilters from "./matchesFilters/index.js";
import toNode from "./toNode/index.js";

/**
 * The nodes the intent tree draws and its count line. With no filter, the tree in order minus every
 * node under a collapsed folder, each collapsed folder saying how many modules it hides. With any
 * filter (a query on the path, only open work, only misaligned, has a plan, has a todo) the tree flattens: the matching
 * nodes at depth 0, full paths, no chevrons, no collapse.
 */
export default function buildTreeRows({
	tree,
	query,
	onlyOpen,
	onlyMisaligned,
	onlyPlans = false,
	onlyTodos = false,
	collapsed,
}: {
	tree: TreeData;
	query: string;
	onlyOpen: boolean;
	onlyMisaligned: boolean;
	onlyPlans?: boolean;
	onlyTodos?: boolean;
	collapsed: ReadonlySet<string>;
}): { nodes: TreeNodeModel[]; countLine: string } {
	const text = query.trim().toLowerCase();
	const flat = onlyOpen || onlyMisaligned || onlyPlans || onlyTodos || text !== "";

	const shown = flat
		? tree.entries.filter((entry) => matchesFilters({ entry, query: text, onlyOpen, onlyMisaligned, onlyPlans, onlyTodos }))
		: tree.entries.filter((entry) => !entry.ancestors.some((folder) => collapsed.has(folder)));
	const nodes = shown.map((entry) => toNode({ entry, flat, collapsed }));

	return { nodes, countLine: buildCountLine({ counts: tree.counts, shown: nodes.length }) };
}
