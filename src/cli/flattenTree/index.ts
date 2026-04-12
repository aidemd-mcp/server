import type { TreeNode } from "@/types/index.js";

/** A flattened node with its depth for rendering and cursor indexing. */
export interface FlatNode {
	node: TreeNode;
	depth: number;
}

/**
 * Convert a hierarchical TreeNode[] into a flat array of { node, depth } entries
 * in display order (depth-first). Dir nodes appear before their children.
 */
export default function flattenTree(nodes: TreeNode[], depth = 0): FlatNode[] {
	const result: FlatNode[] = [];
	for (const node of nodes) {
		result.push({ node, depth });
		if (node.kind === "dir") {
			for (const child of flattenTree(node.children, depth + 1)) result.push(child);
		}
	}
	return result;
}
