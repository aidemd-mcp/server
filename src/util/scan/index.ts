import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";
import type { AideFile, ScanResult } from "@/types/index.js";
import { classifyFile } from "@/util/classify/index.js";
import { SKIP_DIRS } from "@/types/index.js";

/** Extract the first meaningful body line as the summary, truncated to ~80 chars. */
function extractSummary(content: string): string {
	const lines = content.split("\n");

	let bodyStart = 0;

	// Skip YAML frontmatter if present
	if (lines[0] && lines[0].trim() === "---") {
		let closingIdx = -1;
		for (let i = 1; i < lines.length; i++) {
			if (lines[i].trim() === "---") {
				closingIdx = i;
				break;
			}
		}
		bodyStart = closingIdx !== -1 ? closingIdx + 1 : lines.length;
	}

	// Find the first non-empty, non-heading line after frontmatter
	for (let i = bodyStart; i < lines.length; i++) {
		const line = lines[i].trim();
		if (!line || line.startsWith("#")) continue;
		if (line.length <= 80) return line;
		return line.slice(0, 77) + "...";
	}

	return "";
}

/** Normalize a Windows or mixed path to POSIX forward slashes. */
function toPosix(p: string): string {
	return p.split("\\").join("/");
}

/** Recursively walk a directory and collect all .aide files. */
async function walk(dir: string, root: string, files: AideFile[], shallow: boolean): Promise<void> {
	let entries;
	try {
		entries = await readdir(dir, { withFileTypes: true });
	} catch {
		return;
	}

	for (const entry of entries) {
		const fullPath = join(dir, entry.name);

		if (entry.isDirectory()) {
			if (SKIP_DIRS.includes(entry.name as (typeof SKIP_DIRS)[number])) continue;
			await walk(fullPath, root, files, shallow);
			continue;
		}

		if (!entry.name.endsWith(".aide")) continue;

		let summary = "";
		if (!shallow) {
			try {
				const buf = await readFile(fullPath, { encoding: "utf-8" });
				summary = extractSummary(buf.slice(0, 1000));
			} catch {
				// skip unreadable files
			}
		}

		files.push({
			path: fullPath,
			relativePath: toPosix(relative(root, fullPath)),
			type: classifyFile(entry.name),
			summary,
		});
	}
}

/**
 * Recursively walk the filesystem from `root` and collect all .aide files.
 * Skips node_modules, .git, dist, build, .next, coverage, __pycache__.
 * Reads the first ~1000 bytes of each file to extract the first meaningful body line as summary.
 */
export default async function scan(root: string, path?: string, shallow?: boolean): Promise<ScanResult> {
	const scanRoot = path ? join(root, path) : root;
	const files: AideFile[] = [];
	await walk(scanRoot, root, files, !!shallow);
	return { root, files };
}
