import type { ScanResult } from "../../types/index.js";

/**
 * Recursively walk the filesystem from `root` and collect all .aide files.
 * Skips node_modules, .git, dist, build, .next, coverage, __pycache__.
 * Reads the first ~500 bytes of each file for summary extraction.
 */
export default async function scan(root: string, path?: string): Promise<ScanResult> {
	// TODO: implement — recursive fs walk, match *.aide files, extract summaries
	throw new Error("Not implemented");
}
