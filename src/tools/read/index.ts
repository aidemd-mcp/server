import { z } from "zod";
import type { ReadResult } from "../../types/index.js";

export const ReadInput = z.object({
	path: z.string().describe("Path to the .aide file to read"),
});

/**
 * Read an .aide file with context awareness.
 * Returns the file content, classified type, sibling specs in the same
 * directory, and links found in the content.
 */
export default async function read(root: string, path: string): Promise<ReadResult> {
	// TODO: implement — read file, classify, find siblings, extract links
	throw new Error("Not implemented");
}
