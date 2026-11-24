import type { TreeEntry, TreeNodeModel } from "@/observer/page/types/index.js";

/**
 * One tree entry as the node the tree draws. In the tree, a folder in `collapsed` is closed and says
 * how many modules it hides; in a filtered list (`flat`) the node stands alone at depth 0, a leaf
 * with its full path.
 */
export default function toNode({ entry, flat, collapsed }: { entry: TreeEntry; flat: boolean; collapsed: ReadonlySet<string> }): TreeNodeModel {
	const node: TreeNodeModel = {
		folder: entry.folder,
		path: entry.path,
		depth: flat ? 0 : entry.depth,
		description: entry.description,
		alignment: entry.alignment,
		chips: entry.chips,
		current: entry.current,
		misaligned: entry.misaligned,
		hasChildren: !flat && entry.hasChildren,
		collapsed: false,
		hiddenCount: 0,
	};
	if (!node.hasChildren || !collapsed.has(entry.folder)) return node;
	return { ...node, collapsed: true, hiddenCount: entry.descendants };
}
