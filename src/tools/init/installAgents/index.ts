import { access } from "node:fs/promises";
import { join } from "node:path";
import type { InitStep } from "@/types/index.js";
import {
	readCanonicalDoc,
	listAgents,
} from "@/tools/init/initContent/index.js";

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
 * Return planning steps for each canonical AIDE pipeline agent file.
 *
 * For each agent named by `listAgents()`, checks whether the host file
 * already exists. Returns `exists` for present files, `would-create` with
 * the canonical content for absent files. A failing canonical read returns
 * `would-skip` for that entry only.
 *
 * This helper never writes to disk — it is a planner only.
 */
export default async function installAgents(
	agentDir: string,
	displayPrefix: string = "agents",
): Promise<InitStep[]> {
	const steps: InitStep[] = [];

	for (const entry of listAgents()) {
		const targetPath = join(agentDir, entry.hostFilename);
		const displayName = `${displayPrefix}/${entry.hostFilename}`;

		if (await fileExists(targetPath)) {
			steps.push({
				name: displayName,
				status: "exists",
				category: "agents",
				filePath: targetPath,
			});
			continue;
		}

		let content: string;
		try {
			content = readCanonicalDoc(entry.canonical);
		} catch {
			steps.push({
				name: displayName,
				status: "would-skip",
				category: "agents",
				filePath: targetPath,
			});
			continue;
		}

		steps.push({
			name: displayName,
			status: "would-create",
			category: "agents",
			filePath: targetPath,
			content,
		});
	}

	return steps;
}
