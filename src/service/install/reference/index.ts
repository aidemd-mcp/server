import { dirname, join } from "node:path";
import type { InitStep } from "@/types/index.js";
import {
	readCanonicalDoc,
	listReferencePages,
} from "@/service/install/initContent/index.js";
import compareBytes from "@/service/install/shared/compareBytes/index.js";

/**
 * Plan the tool and hook reference as a category of its own, apart from the
 * methodology docs: one install step per page the roster in initContent names
 * (`listReferencePages()`), each kept in its set folder (`tools/` or `hooks/`)
 * under the host's `.aide/reference/` folder, which sits beside the doc hub
 * the way `versions.json` does.
 *
 * Each step carries the `reference` category and one of four statuses:
 * - `would-create`: the page does not exist on disk.
 * - `exists`: the page exists and its bytes are identical to canonical.
 * - `would-overwrite`: the page exists but its bytes differ from canonical.
 * - `would-skip`: the canonical page could not be read.
 *
 * A failing read of one page returns `would-skip` for that page only and does
 * not affect the other steps. Pages with content to write carry the canonical
 * bytes unmodified.
 *
 * This planner never writes to disk.
 */
export default async function reference({
	projectRoot,
	docHubDir,
}: {
	projectRoot: string;
	docHubDir: string;
}): Promise<InitStep[]> {
	const displayPrefix = `${dirname(docHubDir)}/reference`;
	const referenceDir = join(projectRoot, displayPrefix);
	const steps: InitStep[] = [];

	for (const entry of listReferencePages()) {
		const filePath = join(referenceDir, entry.hostPath);
		const name = `${displayPrefix}/${entry.hostPath}`.replaceAll("\\", "/");

		let content: string;
		try {
			content = readCanonicalDoc(entry.canonical);
		} catch {
			steps.push({
				name,
				status: "would-skip",
				category: "reference",
				filePath,
			});
			continue;
		}

		const status = await compareBytes(filePath, content);

		if (status === "would-skip") {
			steps.push({ name, status: "exists", category: "reference", filePath });
			continue;
		}

		steps.push({ name, status, category: "reference", filePath, content });
	}

	return steps;
}
