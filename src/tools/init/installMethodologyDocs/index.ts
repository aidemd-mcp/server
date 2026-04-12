import { access } from "node:fs/promises";
import { join } from "node:path";
import type { InitStep } from "@/types/index.js";
import {
	readCanonicalDoc,
	listMethodologyDocs,
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
 * Return planning steps for each canonical AIDE methodology doc.
 *
 * For each doc named by `listMethodologyDocs()` — including the hub index —
 * checks whether the host file already exists. Returns `exists` for present
 * files, `would-create` with the canonical content for absent files.
 *
 * A failing read of one canonical doc returns `would-skip` for that entry
 * only and does not affect the other steps.
 *
 * This helper never writes to disk — it is a planner only.
 */
export default async function installMethodologyDocs(
	docHubDir: string,
	displayPrefix: string = ".aide",
): Promise<InitStep[]> {
	const steps: InitStep[] = [];

	for (const entry of listMethodologyDocs()) {
		const targetPath = join(docHubDir, entry.hostFilename);
		const displayName = `${displayPrefix}/${entry.hostFilename}`;

		if (await fileExists(targetPath)) {
			steps.push({
				name: displayName,
				status: "exists",
				category: "methodology",
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
				category: "methodology",
				filePath: targetPath,
			});
			continue;
		}

		steps.push({
			name: displayName,
			status: "would-create",
			category: "methodology",
			filePath: targetPath,
			content,
		});
	}

	return steps;
}
