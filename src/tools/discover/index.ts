import { z } from "zod";
import { basename } from "node:path";
import scan from "../../lib/scan/index.js";
import buildTree from "../../lib/buildTree/index.js";
import { detectAnomalies } from "../../lib/classify/index.js";

export const DiscoverInput = z.object({
	path: z.string().optional().describe("Subdirectory to scan (defaults to entire project)"),
});

/**
 * Scan for .aide files and return a progressive disclosure tree map.
 *
 * Without a path: shallow scan of the entire project — returns file locations
 * and types only (no summaries, no content reading). This is the project map
 * the agent uses to understand where specs live.
 *
 * With a path: deep scan of that subtree — includes summaries extracted from
 * file content, plus anomaly warnings. This is how the agent drills into the
 * area it's working on.
 */
export default async function discover(root: string, path?: string): Promise<string> {
	const shallow = !path;
	const result = await scan(root, path, shallow);
	const { files } = result;

	if (files.length === 0) {
		return "No .aide files found." + (path ? ` (searched in ${path})` : "");
	}

	const projectName = basename(root);
	const header = `${projectName} project — ${files.length} spec${files.length === 1 ? "" : "s"} found`;

	const tree = buildTree(files, root);

	// Only run anomaly detection on deep (scoped) scans
	let warningBlock = "";
	if (!shallow) {
		const anomalies = await detectAnomalies(files, root);
		if (anomalies.length > 0) {
			const lines = anomalies.map((w) => `  ${w.path} — ${w.message}`);
			warningBlock = `\n\n⚠ Warnings:\n${lines.join("\n")}`;
		}
	}

	return `${header}\n\n${tree}${warningBlock}`;
}
