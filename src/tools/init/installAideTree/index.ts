import { join } from "node:path";
import type { InitStep } from "@/types/index.js";
import { readCanonicalDoc } from "@/tools/init/initContent/index.js";
import compareBytes from "@/tools/init/shared/compareBytes/index.js";

/**
 * Return a planning step for the aide-tree launcher script.
 *
 * Compares `.aide/bin/aide-tree.mjs` under `projectRoot` against the canonical
 * script content:
 * - `would-create`: file does not exist on disk.
 * - `exists`: file exists and its bytes are identical to canonical.
 * - `would-overwrite`: file exists but its bytes differ from canonical.
 *
 * A failing canonical read returns `would-skip`.
 *
 * This helper never writes to disk — it is a planner only.
 */
export default async function installAideTree(projectRoot: string): Promise<InitStep[]> {
	const targetPath = join(projectRoot, ".aide", "bin", "aide-tree.mjs");
	const displayName = ".aide/bin/aide-tree.mjs";

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

	const status = await compareBytes(targetPath, content);

	if (status === "would-skip") {
		return [
			{
				name: displayName,
				status: "exists",
				category: "commands",
				filePath: targetPath,
			},
		];
	}

	return [
		{
			name: displayName,
			status,
			category: "commands",
			filePath: targetPath,
			content,
		},
	];
}
