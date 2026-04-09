import { readdir, readFile } from "node:fs/promises";
import { join, dirname, basename, relative } from "node:path";
import type { AideFile, AideFileType, ValidationWarning } from "../../types/index.js";
import { SKIP_DIRS } from "../../types/index.js";

/**
 * Classify a filename into an AideFileType based on naming conventions:
 * - `.aide` or `intent.aide` → "intent"
 * - `research.aide` → "research"
 * - `todo.aide` → "todo"
 */
export function classifyFile(filename: string): AideFileType {
	const base = basename(filename);
	if (base === "research.aide") return "research";
	if (base === "todo.aide") return "todo";
	return "intent";
}

/** Check if a file has 2+ relative `./` imports (orchestrator heuristic). */
async function countRelativeImports(filePath: string): Promise<number> {
	try {
		const content = await readFile(filePath, "utf-8");
		const matches = content.match(/(?:import|from)\s+["']\.\/[^"']+["']/g);
		return matches ? matches.length : 0;
	} catch {
		return 0;
	}
}

/** Check if a directory contains an orchestrator file (index.ts or index.js). */
async function findOrchestrator(dir: string): Promise<string | null> {
	try {
		const entries = await readdir(dir);
		for (const name of entries) {
			if (name === "index.ts" || name === "index.js") return join(dir, name);
		}
	} catch {
		// skip unreadable dirs
	}
	return null;
}

/**
 * Detect anomalies across a set of .aide files:
 * - .aide + intent.aide in the same folder (naming conflict)
 * - research.aide without a corresponding intent spec (orphaned research)
 * - .aide in a folder with no orchestrator index.ts (orphaned spec)
 * - Orchestrators with 3+ helper imports but no .aide (missing spec)
 */
export async function detectAnomalies(
	files: AideFile[],
	root: string,
): Promise<ValidationWarning[]> {
	const warnings: ValidationWarning[] = [];

	// Group files by directory (using absolute path dirname)
	const byDir = new Map<string, AideFile[]>();
	for (const file of files) {
		const dir = dirname(file.path);
		const group = byDir.get(dir) ?? [];
		group.push(file);
		byDir.set(dir, group);
	}

	// Collect all directories that have .aide files (for missing-spec scan)
	const dirsWithSpecs = new Set(byDir.keys());

	for (const [dir, dirFiles] of byDir) {
		const names = dirFiles.map((f) => basename(f.path));
		const relDir = dirFiles[0].relativePath.split("/").slice(0, -1).join("/") || ".";

		// naming-conflict: .aide + intent.aide in same folder
		if (names.includes(".aide") && names.includes("intent.aide")) {
			warnings.push({
				kind: "naming-conflict",
				path: relDir,
				message: "Both .aide and intent.aide exist. Remove .aide or rename to intent.aide.",
			});
		}

		// orphaned-research: research.aide without intent spec
		const hasResearch = names.includes("research.aide");
		const hasIntent = names.includes(".aide") || names.includes("intent.aide");
		if (hasResearch && !hasIntent) {
			warnings.push({
				kind: "orphaned-research",
				path: relDir,
				message: "research.aide exists without a corresponding intent spec.",
			});
		}

		// orphaned-spec: .aide in folder with no orchestrator
		const orchestrator = await findOrchestrator(dir);
		if (!orchestrator) {
			warnings.push({
				kind: "orphaned-spec",
				path: relDir,
				message: "Spec file(s) in folder with no orchestrator (index.ts/index.js).",
			});
		}
	}

	// missing-spec: find orchestrators with 3+ relative imports but no .aide
	// Scan directories that DON'T already have specs
	await scanForMissingSpecs(root, root, dirsWithSpecs, warnings);

	return warnings;
}

/** Walk the project looking for orchestrators without specs. */
async function scanForMissingSpecs(
	dir: string,
	root: string,
	dirsWithSpecs: Set<string>,
	warnings: ValidationWarning[],
): Promise<void> {
	let entries;
	try {
		entries = await readdir(dir, { withFileTypes: true });
	} catch {
		return;
	}

	const skipSet = new Set<string>(SKIP_DIRS);

	for (const entry of entries) {
		if (!entry.isDirectory()) continue;
		if (skipSet.has(entry.name)) continue;

		const subdir = join(dir, entry.name);

		// Only check dirs that don't already have specs
		if (!dirsWithSpecs.has(subdir)) {
			const orchestrator = await findOrchestrator(subdir);
			if (orchestrator) {
				const importCount = await countRelativeImports(orchestrator);
				if (importCount >= 3) {
					const relPath = relative(root, subdir).split("\\").join("/");
					warnings.push({
						kind: "missing-spec",
						path: relPath,
						message: `Orchestrator has ${importCount} helper imports but no .aide file.`,
					});
				}
			}
		}

		await scanForMissingSpecs(subdir, root, dirsWithSpecs, warnings);
	}
}
