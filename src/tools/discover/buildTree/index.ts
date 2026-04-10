import type { AideFile } from "@/types/index.js";
import { basename } from "node:path";

/** Sort priority for file types: intent first, then research, then todo. */
const TYPE_ORDER = { intent: 0, research: 1, todo: 2 } as const;

/** Group files by their parent directory path. */
function groupByDir(files: AideFile[]): Map<string, AideFile[]> {
	const groups = new Map<string, AideFile[]>();
	for (const file of files) {
		const parts = file.relativePath.split("/");
		const dir = parts.slice(0, -1).join("/") || ".";
		const group = groups.get(dir) ?? [];
		group.push(file);
		groups.set(dir, group);
	}
	return groups;
}

/** Sort files within a directory by type priority, then by name. */
function sortFiles(files: AideFile[]): AideFile[] {
	return [...files].sort((a, b) => {
		const typeA = TYPE_ORDER[a.type];
		const typeB = TYPE_ORDER[b.type];
		if (typeA !== typeB) return typeA - typeB;
		return basename(a.relativePath).localeCompare(basename(b.relativePath));
	});
}

/**
 * Build a progressive disclosure tree string from discovered .aide files.
 * Collapses directories with no .aide files. Each entry shows:
 * - Relative path with tree-drawing characters
 * - File type tag in brackets: [intent], [research], [todo]
 * - Truncated summary (~80 chars) from first paragraph
 */
export default function buildTree(files: AideFile[], root: string): string {
	if (files.length === 0) return "";

	const groups = groupByDir(files);
	const sortedDirs = [...groups.keys()].sort();

	const lines: string[] = [];

	for (let d = 0; d < sortedDirs.length; d++) {
		const dir = sortedDirs[d];
		const dirFiles = sortFiles(groups.get(dir)!);

		// Directory header
		lines.push(`${dir}/`);

		for (let f = 0; f < dirFiles.length; f++) {
			const file = dirFiles[f];
			const isLastFile = f === dirFiles.length - 1;
			const connector = isLastFile ? "└──" : "├──";
			const name = basename(file.relativePath);
			const tag = `[${file.type}]`;
			const summary = file.summary ? ` — ${file.summary}` : "";
			lines.push(`  ${connector} ${name} ${tag}${summary}`);
		}

		if (d < sortedDirs.length - 1) lines.push("");
	}

	return lines.join("\n");
}
