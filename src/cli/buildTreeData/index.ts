import { dirname } from "node:path";
import type { AideFile, AideFileType, TreeNode } from "@/types/index.js";

/** Priority order for sorting files within a directory: intent first, then research, plan, todo. */
const TYPE_PRIORITY: Record<AideFileType, number> = {
	intent: 0,
	research: 1,
	plan: 2,
	todo: 3,
};

/** Derive the display directory path for a file: POSIX-normalized dirname, or "." for root files. */
function dirOf(file: AideFile): string {
	const parts = file.relativePath.split("/");
	if (parts.length === 1) return ".";
	return parts.slice(0, -1).join("/");
}

/**
 * Convert a flat AideFile[] from scan() into a hierarchical TreeNode[] for TUI rendering.
 * Directories are sorted alphabetically; files within each directory are sorted by type priority.
 * Root-level files appear under the "." directory group.
 */
export default function buildTreeData(files: AideFile[]): TreeNode[] {
	// Group files by their directory path.
	const byDir = new Map<string, AideFile[]>();
	for (const file of files) {
		const dir = dirOf(file);
		const group = byDir.get(dir) ?? [];
		group.push(file);
		byDir.set(dir, group);
	}

	// Sort files within each directory by type priority, then by filename.
	for (const group of byDir.values()) {
		group.sort((a, b) => {
			const pd = TYPE_PRIORITY[a.type] - TYPE_PRIORITY[b.type];
			if (pd !== 0) return pd;
			return a.relativePath.localeCompare(b.relativePath);
		});
	}

	// Sort directories alphabetically, root "." first.
	const dirs = [...byDir.keys()].sort((a, b) => {
		if (a === ".") return -1;
		if (b === ".") return 1;
		return a.localeCompare(b);
	});

	return dirs.map((dir): TreeNode => ({
		kind: "dir",
		path: dir,
		children: (byDir.get(dir) ?? []).map((file): TreeNode => ({ kind: "file", file })),
	}));
}
