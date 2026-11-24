import type { AideFile, TreeNode } from "@/types/index.js";

/**
 * Given a dir-kind TreeNode, returns the first file child whose type is "intent"
 * (i.e. a `.aide` or `intent.aide` file), or null if the dir has no intent child.
 *
 * This is a pure synchronous function — it reads from the already-loaded TreeNode
 * data, not the filesystem. Its primary role is powering the detail panel auto-load:
 * when the cursor lands on a dir node, App calls findPrimaryIntent to obtain the
 * intent file so the detail panel can display its frontmatter without requiring
 * the user to expand and explicitly select the file.
 */
export default function findPrimaryIntent(node: TreeNode): AideFile | null {
	if (node.kind !== "dir") return null;
	for (const child of node.children) {
		if (child.kind === "file" && child.file.type === "intent") {
			return child.file;
		}
	}
	return null;
}
