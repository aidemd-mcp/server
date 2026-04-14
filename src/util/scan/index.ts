import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";
import type { AideFile, AideFrontmatter, ScanResult } from "@/types/index.js";
import { classifyFile } from "@/util/classify/index.js";
import { SKIP_DIRS } from "@/types/index.js";
import parseFrontmatter from "@/util/parseFrontmatter/index.js";

/** Count checked and total checkbox items in content. */
function countCheckboxes(content: string): { done: number; total: number } {
	const lines = content.split("\n");
	let done = 0;
	let total = 0;
	for (const line of lines) {
		const trimmed = line.trim();
		if (trimmed.startsWith("- [x]") || trimmed.startsWith("- [X]")) {
			done++;
			total++;
		} else if (trimmed.startsWith("- [ ]")) {
			total++;
		}
	}
	return { done, total };
}

/** Normalize a Windows or mixed path to POSIX forward slashes. */
function toPosix(p: string): string {
	return p.split("\\").join("/");
}

/**
 * Derive a description from frontmatter, falling back to the first sentence of
 * `intent` when `description` is absent — matching the logic in buildAncestorChain.
 */
function deriveDescription(frontmatter: AideFrontmatter | null | undefined): string {
	if (frontmatter?.description) return frontmatter.description;
	if (frontmatter?.intent) return frontmatter.intent.split(/[.\n]/)[0] ?? "";
	return "";
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
		let description = "";
		let status: "aligned" | "misaligned" | undefined;

		const type = classifyFile(entry.name);

		if (!shallow) {
			try {
				const buf = await readFile(fullPath, { encoding: "utf-8" });
				const { frontmatter } = parseFrontmatter(buf);
				description = deriveDescription(frontmatter);
				if (frontmatter?.status) status = frontmatter.status;

				if (type === "plan" || type === "todo") {
					const { done, total } = countCheckboxes(buf);
					summary = total > 0 ? `${done}/${total} done` : "";
				}
			} catch {
				// skip unreadable files
			}
		} else {
			// In shallow mode, read only the first ~500 bytes to capture frontmatter
			// without loading the full body — keeps startup fast for large projects.
			try {
				const buf = await readFile(fullPath, { encoding: "utf-8" });
				const head = buf.slice(0, 500);
				const { frontmatter } = parseFrontmatter(head);
				description = deriveDescription(frontmatter);
				if (frontmatter?.status) status = frontmatter.status;
			} catch {
				// skip unreadable files
			}
		}

		files.push({
			path: fullPath,
			relativePath: toPosix(relative(root, fullPath)),
			type,
			summary,
			description,
			status,
		});
	}
}

/**
 * Recursively walk the filesystem from `root` and collect all .aide files.
 * Skips node_modules, .git, dist, build, .next, coverage, __pycache__.
 * In deep mode: reads full content to extract summary, description, and status.
 * In shallow mode: reads only the first ~500 bytes per file to extract frontmatter
 * description and status — summary stays empty but descriptions appear unconditionally.
 */
export default async function scan(root: string, path?: string, shallow?: boolean): Promise<ScanResult> {
	const scanRoot = path ? join(root, path) : root;
	const files: AideFile[] = [];
	await walk(scanRoot, root, files, !!shallow);
	return { root, files };
}
