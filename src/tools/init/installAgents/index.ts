import { writeFile, mkdir, access } from "node:fs/promises";
import { join, dirname } from "node:path";
import type { InitStepResult } from "@/types/index.js";
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
 * Install the canonical AIDE pipeline agent files into the host's agent
 * directory. Each agent named by `listAgents()` is written verbatim into
 * a namespaced subfolder under `agentDir`. Existing files are preserved
 * so user customizations survive re-runs. A failing read of one agent is
 * reported as `skipped` for that entry only.
 */
export default async function installAgents(
	agentDir: string,
	displayPrefix: string = "agents",
): Promise<InitStepResult[]> {
	const results: InitStepResult[] = [];
	await mkdir(agentDir, { recursive: true });

	for (const entry of listAgents()) {
		const targetPath = join(agentDir, entry.hostFilename);
		const displayName = `${displayPrefix}/${entry.hostFilename}`;

		if (await fileExists(targetPath)) {
			results.push({ name: displayName, status: "exists" });
			continue;
		}

		let content: string;
		try {
			content = readCanonicalDoc(entry.canonical);
		} catch {
			results.push({ name: displayName, status: "skipped" });
			continue;
		}

		await mkdir(dirname(targetPath), { recursive: true });
		await writeFile(targetPath, content, "utf-8");
		results.push({ name: displayName, status: "created" });
	}

	return results;
}
