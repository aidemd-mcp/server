import { writeFile, mkdir, access } from "node:fs/promises";
import { join, dirname } from "node:path";
import type { InitStepResult } from "@/types/index.js";
import {
	readCanonicalDoc,
	listSkills,
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
 * Install the canonical AIDE skill templates into the host's skill
 * directory. Each skill named by `listSkills()` is written verbatim.
 * Existing files are preserved so user customizations survive re-runs.
 */
export default async function installSkills(
	skillDir: string,
	displayPrefix: string = "skills",
): Promise<InitStepResult[]> {
	const results: InitStepResult[] = [];
	await mkdir(skillDir, { recursive: true });

	for (const entry of listSkills()) {
		const targetPath = join(skillDir, entry.hostPath);
		const displayName = `${displayPrefix}/${entry.hostPath}`;

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
