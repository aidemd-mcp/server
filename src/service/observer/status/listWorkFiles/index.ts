import type { ModuleNode, TreeFileEntry, WorkFileEntry } from "../types/index.js";

/** True for plan and todo entries (the entry's `kind` is a union, so it does not narrow on its own). */
function isWorkFile(entry: TreeFileEntry): entry is WorkFileEntry {
	return entry.kind === "plan" || entry.kind === "todo";
}

/**
 * List every plan and todo in the tree, malformed ones included, sorted by file path.
 * Briefs, specs and every other kind are not listed.
 */
export default function listWorkFiles({ nodes }: { nodes: ModuleNode[] }): WorkFileEntry[] {
	const entries: WorkFileEntry[] = [];

	for (const node of nodes) {
		for (const entry of node.files) {
			if (isWorkFile(entry)) entries.push(entry);
		}
	}

	return entries.sort((a, b) => (a.file < b.file ? -1 : a.file > b.file ? 1 : 0));
}
