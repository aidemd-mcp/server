import type { AideFile, AideFileType, ValidationWarning } from "../../types/index.js";

/**
 * Classify a filename into an AideFileType based on naming conventions:
 * - `.aide` or `intent.aide` → "intent"
 * - `research.aide` → "research"
 * - `todo.aide` → "todo"
 */
export function classifyFile(filename: string): AideFileType {
	// TODO: implement — match filename against type rules
	throw new Error("Not implemented");
}

/**
 * Detect anomalies across a set of .aide files:
 * - .aide + intent.aide in the same folder (naming conflict)
 * - research.aide without a corresponding intent spec (orphaned research)
 * - .aide in a folder with no orchestrator index.ts (orphaned spec)
 * - Orchestrators with 3+ helper imports but no .aide (missing spec)
 */
export async function detectAnomalies(
	files: AideFile[],
	root: string,
): Promise<ValidationWarning[]> {
	// TODO: implement — group by directory, check for conflicts and orphans
	throw new Error("Not implemented");
}
