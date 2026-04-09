import { z } from "zod";

export const ScaffoldInput = z.object({
	directory: z.string().describe("Directory where the .aide file(s) will be created"),
	type: z
		.enum(["intent", "research", "both", "todo"])
		.describe("Type of .aide file to create"),
});

/**
 * Create new .aide files with correct naming conventions.
 * Handles auto-rename logic:
 * - type=intent + no research.aide → creates .aide
 * - type=intent + research.aide exists → creates intent.aide
 * - type=research → creates research.aide; renames existing .aide to intent.aide
 * - type=both → creates research.aide + intent.aide
 * - type=todo → creates todo.aide
 */
export default async function scaffold(
	root: string,
	directory: string,
	type: "intent" | "research" | "both" | "todo",
): Promise<string> {
	// TODO: implement — check existing files, apply naming rules, write templates
	throw new Error("Not implemented");
}
