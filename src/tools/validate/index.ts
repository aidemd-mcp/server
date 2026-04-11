import { z } from "zod";
import { readFile, access } from "node:fs/promises";
import { join, dirname, isAbsolute } from "node:path";
import type { ValidationResult, ValidationWarning } from "@/types/index.js";
import scan from "@/util/scan/index.js";
import { detectAnomalies } from "@/util/classify/index.js";

export const ValidateInput = z.object({
	path: z.string().optional().describe("Subdirectory to validate (defaults to entire project)"),
});

/** Check relative path links in .aide file content and return broken ones. */
async function checkBrokenLinks(
	filePath: string,
	content: string,
	relativePath: string,
): Promise<ValidationWarning[]> {
	const warnings: ValidationWarning[] = [];
	const dir = dirname(filePath);

	// Match relative paths: ./something or ../something
	const relPathRegex = /(?:^|\s)(\.\.?\/[^\s),\]]+)/gm;
	for (const match of content.matchAll(relPathRegex)) {
		const linkPath = match[1];
		const resolved = join(dir, linkPath);
		try {
			await access(resolved);
		} catch {
			warnings.push({
				kind: "broken-link",
				path: relativePath,
				message: `Broken relative link: ${linkPath}`,
			});
		}
	}

	return warnings;
}

/**
 * Check project health for .aide file issues:
 * - Orphaned specs (.aide in folders with no orchestrator)
 * - Missing specs (orchestrators with 3+ helper imports but no .aide)
 * - Naming conflicts (.aide + intent.aide in same folder)
 * - Broken links (relative paths in spec content that don't resolve)
 * - Orphaned research (research.aide without corresponding intent spec)
 */
export default async function validate(root: string, path?: string): Promise<ValidationResult> {
	const result = await scan(root, path);
	const { files } = result;

	// Structural anomalies
	const warnings: ValidationWarning[] = await detectAnomalies(files, root);

	// Broken link checks
	for (const file of files) {
		try {
			const content = await readFile(file.path, "utf-8");
			const linkWarnings = await checkBrokenLinks(file.path, content, file.relativePath);
			warnings.push(...linkWarnings);
		} catch {
			// skip unreadable files
		}
	}

	return { root, warnings };
}
