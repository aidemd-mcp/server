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
 * Delegates to scan for file discovery, classify for anomaly detection,
 * and buildTree for formatted output.
 */
export default async function discover(root: string, path?: string): Promise<string> {
	const result = await scan(root, path);
	const { files } = result;

	if (files.length === 0) {
		return "No .aide files found." + (path ? ` (searched in ${path})` : "");
	}

	const projectName = basename(root);
	const header = `${projectName} project — ${files.length} spec${files.length === 1 ? "" : "s"} found`;

	const tree = buildTree(files, root);

	const anomalies = await detectAnomalies(files, root);
	let warningBlock = "";
	if (anomalies.length > 0) {
		const lines = anomalies.map((w) => `  ${w.path} — ${w.message}`);
		warningBlock = `\n\n⚠ Warnings:\n${lines.join("\n")}`;
	}

	return `${header}\n\n${tree}${warningBlock}`;
}
