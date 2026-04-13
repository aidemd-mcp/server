import { z } from "zod";
import { basename, join } from "node:path";
import scan from "@/util/scan/index.js";
import buildTree from "@/tools/discover/buildTree/index.js";
import buildAncestorChain from "./buildAncestorChain/index.js";
import { detectAnomalies } from "@/util/classify/index.js";

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

	// Only run anomaly detection and ancestor chain on deep (scoped) scans
	let ancestorChain = "";
	let warningBlock = "";
	if (!shallow) {
		ancestorChain = await buildAncestorChain(root, join(root, path));

		const anomalies = await detectAnomalies(files, root);
		if (anomalies.length > 0) {
			const lines = anomalies.map((w) => `  ${w.path} — ${w.message}`);
			warningBlock = `\n\n⚠ Warnings:\n${lines.join("\n")}`;
		}
	}

	// Build output: header + optional ancestor chain + tree + optional warnings
	// Each block separated by a blank line when present
	const parts: string[] = [header];
	if (ancestorChain) parts.push(ancestorChain);
	parts.push(tree);

	return parts.join("\n\n") + warningBlock;
}
