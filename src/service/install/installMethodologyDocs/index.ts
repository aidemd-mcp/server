import { join } from "node:path";
import type { InitStep } from "@/types/index.js";
import {
	readCanonicalDoc,
	listMethodologyDocs,
} from "@/service/install/initContent/index.js";
import compareBytes from "@/service/install/shared/compareBytes/index.js";

/**
 * Return planning steps for each canonical AIDE methodology doc.
 *
 * For each doc named by `listMethodologyDocs()` — including the index —
 * compares the host file bytes against the canonical content:
 * - `would-create`: file does not exist on disk.
 * - `exists`: file exists and its bytes are identical to canonical.
 * - `would-overwrite`: file exists but its bytes differ from canonical.
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

		const status = await compareBytes(targetPath, content);

		if (status === "would-skip") {
			steps.push({
				name: displayName,
				status: "exists",
				category: "methodology",
				filePath: targetPath,
			});
			continue;
		}

		steps.push({
			name: displayName,
			status,
			category: "methodology",
			filePath: targetPath,
			content,
		});
	}

	return steps;
}
