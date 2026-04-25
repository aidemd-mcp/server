import { join } from "node:path";
import type { InitStep } from "@/types/index.js";
import {
	readCanonicalDoc,
	listSkills,
} from "@/service/install/initContent/index.js";
import compareBytes from "@/service/install/shared/compareBytes/index.js";

/**
 * Return planning steps for each canonical AIDE skill template.
 *
 * For each skill named by `listSkills()`, compares the host file bytes against
 * the canonical content:
 * - `would-create`: file does not exist on disk.
 * - `exists`: file exists and its bytes are identical to canonical.
 * - `would-overwrite`: file exists but its bytes differ from canonical.
 *
 * A failing canonical read returns `would-skip` for that entry only and
 * does not affect the other steps.
 *
 * This helper never writes to disk — it is a planner only.
 */
export default async function installSkills(
	skillDir: string,
	displayPrefix: string = "skills",
): Promise<InitStep[]> {
	const steps: InitStep[] = [];

	for (const entry of listSkills()) {
		const targetPath = join(skillDir, entry.hostPath);
		const displayName = `${displayPrefix}/${entry.hostPath}`;

		let content: string;
		try {
			content = readCanonicalDoc(entry.canonical);
		} catch {
			steps.push({
				name: displayName,
				status: "would-skip",
				category: "skills",
				filePath: targetPath,
			});
			continue;
		}

		const status = await compareBytes(targetPath, content);

		if (status === "would-skip") {
			steps.push({
				name: displayName,
				status: "exists",
				category: "skills",
				filePath: targetPath,
			});
			continue;
		}

		steps.push({
			name: displayName,
			status,
			category: "skills",
			filePath: targetPath,
			content,
		});
	}

	return steps;
}
