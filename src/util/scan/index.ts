import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";
import type { AideFile, ScanResult } from "@/types/index.js";
import { classifyFile } from "@/util/classify/index.js";
import { SKIP_DIRS } from "@/types/index.js";

/** Extract the intent field from YAML frontmatter as the summary, truncated to ~80 chars. */
function extractSummary(content: string): string {
	const lines = content.split("\n");

	// Confirm frontmatter starts with ---
	if (!lines[0] || lines[0].trim() !== "---") return "";

	// Find the intent field (don't require closing --- to be in the slice)
	let intent = "";
	for (let i = 1; i < lines.length; i++) {
		const line = lines[i];
		if (line.trim() === "---") break; // end of frontmatter
		if (/^intent:\s*/.test(line)) {
			const inline = line.replace(/^intent:\s*/, "").trim();
			// Block scalar (> or |) — value is on subsequent indented lines
			if (inline === ">" || inline === "|" || inline === ">-" || inline === "|-") {
				const parts: string[] = [];
				for (let j = i + 1; j < lines.length; j++) {
					if (lines[j].trim() === "---") break;
					if (/^\s+/.test(lines[j])) parts.push(lines[j].trim());
					else break; // hit a top-level key like outcomes:
				}
				intent = parts.join(" ");
			} else {
				intent = inline;
			}
			break;
		}
	}

	if (!intent) return "";
	if (intent.length <= 80) return intent;
	return intent.slice(0, 77) + "...";
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
 * Reads the first ~1000 bytes of each file to extract the intent field as summary.
 */
export default async function scan(root: string, path?: string, shallow?: boolean): Promise<ScanResult> {
	const scanRoot = path ? join(root, path) : root;
	const files: AideFile[] = [];
	await walk(scanRoot, root, files, !!shallow);
	return { root, files };
}
