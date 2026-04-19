import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { SKIP_DIRS } from "@/types/index.js";

const SOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]);

/**
 * Async generator that yields absolute file paths for TS/JS source files under
 * a directory tree. Narrows the search space for symbol lookup by skipping
 * non-source directories (node_modules, dist, .git, etc.) and non-source files.
 * When an optional `file` parameter is provided, yields only that single resolved
 * path without walking the directory.
 */
export default async function* walk(dir: string, file?: string): AsyncGenerator<string> {
	if (file) {
		yield join(dir, file);
		return;
	}

	const entries = await readdir(dir, { withFileTypes: true });

	for (const entry of entries) {
		const fullPath = join(dir, entry.name);

		if (entry.isDirectory()) {
			if ((SKIP_DIRS as readonly string[]).includes(entry.name)) continue;
			yield* walk(fullPath);
		} else if (entry.isFile()) {
			const ext = entry.name.slice(entry.name.lastIndexOf("."));
			if (SOURCE_EXTENSIONS.has(ext)) yield fullPath;
		}
	}
}
