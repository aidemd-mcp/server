import { access } from "node:fs/promises";
import { join } from "node:path";
import type { InitStep } from "@/types/index.js";
import { readCanonicalDoc } from "@/tools/init/initContent/index.js";

/** Check if a file exists on disk. */
async function fileExists(path: string): Promise<boolean> {
	try {
		await access(path);
		return true;
	} catch {
		return false;
	}
}

/**
 * Return a planning step for the aide-tree launcher script.
 *
 * Checks whether `.aide/bin/aide-tree.mjs` already exists under `projectRoot`.
 * Returns `exists` if the file is present, `would-create` with the canonical
 * script content if it is absent. A failing canonical read returns `would-skip`.
 *
 * This helper never writes to disk — it is a planner only.
 */
export default async function installAideTree(projectRoot: string): Promise<InitStep[]> {
	const targetPath = join(projectRoot, ".aide", "bin", "aide-tree.mjs");
	const displayName = ".aide/bin/aide-tree.mjs";

	if (await fileExists(targetPath)) {
		return [
			{
				name: displayName,
				status: "exists",
				category: "commands",
				filePath: targetPath,
			},
		];
	}

	let content: string;
	try {
		content = readCanonicalDoc("bin/aide-tree");
	} catch {
		return [
			{
				name: displayName,
				status: "would-skip",
				category: "commands",
				filePath: targetPath,
			},
		];
	}

	return [
		{
			name: displayName,
			status: "would-create",
			category: "commands",
			filePath: targetPath,
			content,
		},
	];
}
