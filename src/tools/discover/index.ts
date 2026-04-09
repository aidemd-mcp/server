import { z } from "zod";

export const DiscoverInput = z.object({
	path: z.string().optional().describe("Subdirectory to scan (defaults to entire project)"),
});

/**
 * Scan for .aide files and return a progressive disclosure tree map.
 * Delegates to scan for file discovery, classify for type detection,
 * and buildTree for formatted output.
 */
export default async function discover(root: string, path?: string): Promise<string> {
	// TODO: implement — scan → classify → buildTree → format output
	throw new Error("Not implemented");
}
