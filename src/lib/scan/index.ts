import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";
import type { AideFile, ScanResult } from "../../types/index.js";
import { classifyFile } from "../classify/index.js";
import { SKIP_DIRS } from "../../types/index.js";

/** Extract a summary from raw file content: first non-empty, non-heading line, truncated to ~80 chars. */
function extractSummary(content: string): string {
	const lines = content.split("\n");
	for (const line of lines) {
		const trimmed = line.trim();
		if (!trimmed) continue;
		if (trimmed.startsWith("#")) continue;
		if (trimmed.startsWith("---")) continue;
		if (trimmed.length <= 80) return trimmed;
		return trimmed.slice(0, 77) + "...";
	}
	return "";
}

/** Normalize a Windows or mixed path to POSIX forward slashes. */
function toPosix(p: string): string {
	return p.split("\\").join("/");
}

/** Recursively walk a directory and collect all .aide files. */
async function walk(dir: string, root: string, files: AideFile[]): Promise<void> {
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
			await walk(fullPath, root, files);
			continue;
		}

		if (!entry.name.endsWith(".aide")) continue;

		let content = "";
		try {
			const buf = await readFile(fullPath, { encoding: "utf-8" });
			content = buf.slice(0, 500);
		} catch {
			// skip unreadable files
		}

		files.push({
			path: fullPath,
			relativePath: toPosix(relative(root, fullPath)),
			type: classifyFile(entry.name),
			summary: extractSummary(content),
		});
	}
}

/**
 * Recursively walk the filesystem from `root` and collect all .aide files.
 * Skips node_modules, .git, dist, build, .next, coverage, __pycache__.
 * Reads the first ~500 bytes of each file for summary extraction.
 */
export default async function scan(root: string, path?: string): Promise<ScanResult> {
	const scanRoot = path ? join(root, path) : root;
	const files: AideFile[] = [];
	await walk(scanRoot, root, files);
	return { root, files };
}
