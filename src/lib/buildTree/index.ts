import type { AideFile } from "../../types/index.js";

/**
 * Build a progressive disclosure tree string from discovered .aide files.
 * Collapses directories with no .aide files. Each entry shows:
 * - Relative path with tree-drawing characters
 * - File type tag in brackets: [intent], [research], [todo]
 * - Truncated summary (~80 chars) from first paragraph
 */
export default function buildTree(files: AideFile[], root: string): string {
	// TODO: implement — group by directory, collapse empty dirs, format tree
	throw new Error("Not implemented");
}
