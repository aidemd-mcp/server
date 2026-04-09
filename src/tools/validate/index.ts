import { z } from "zod";
import type { ValidationResult } from "../../types/index.js";

export const ValidateInput = z.object({
	path: z.string().optional().describe("Subdirectory to validate (defaults to entire project)"),
});

/**
 * Check project health for .aide file issues:
 * - Orphaned specs (.aide in folders with no orchestrator)
 * - Missing specs (orchestrators with 3+ helper imports but no .aide)
 * - Naming conflicts (.aide + intent.aide in same folder)
 * - Broken links (relative paths in spec content that don't resolve)
 * - Orphaned research (research.aide without corresponding intent spec)
 */
export default async function validate(root: string, path?: string): Promise<ValidationResult> {
	// TODO: implement — scan → classify → detectAnomalies → check links
	throw new Error("Not implemented");
}
