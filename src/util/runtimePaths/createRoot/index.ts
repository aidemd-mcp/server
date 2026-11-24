import { mkdir } from "node:fs/promises";
import type { RootPaths } from "../types/index.js";
import resolveRoot from "../resolveRoot/index.js";

/**
 * Create the per-user app-data root when missing, then return the resolved root
 * paths. Creates nothing else: no observer file, no project folder. Any
 * filesystem error other than "already exists" propagates.
 */
export default async function createRoot(): Promise<RootPaths> {
	const paths = resolveRoot();

	// Recursive mkdir is a no-op when the root already exists.
	await mkdir(paths.root, { recursive: true });

	return paths;
}
