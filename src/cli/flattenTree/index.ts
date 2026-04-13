import type { TreeNode } from "@/types/index.js";

/** A flattened node with its depth for rendering and cursor indexing. */
export interface FlatNode {
	node: TreeNode;
	depth: number;
}

/**
 * Convert a hierarchical TreeNode[] into a flat array of { node, depth } entries
 * in display order (depth-first). Dir nodes always appear as cursor stops.
 * A dir's children are only emitted when the dir's path is in `expandedDirs`.
 *
 * @param nodes - The tree nodes to flatten.
 * @param expandedDirs - Set of dir paths that are currently expanded. Defaults to empty Set (all collapsed).
 * @param depth - Current recursion depth (internal use only).
 */
export default function flattenTree(nodes: TreeNode[], expandedDirs: Set<string> = new Set(), depth = 0): FlatNode[] {
	const result: FlatNode[] = [];
	for (const node of nodes) {
		result.push({ node, depth });
		if (node.kind === "dir" && expandedDirs.has(node.path)) {
			for (const child of flattenTree(node.children, expandedDirs, depth + 1)) result.push(child);
		}
	}
	return result;
}
