import { mkdir } from "node:fs/promises";
import type { RuntimePaths } from "../types/index.js";
import resolve from "../resolve/index.js";

/**
 * Create a project's per-user runtime folder (and its events folder) when
 * missing, then return the resolved paths. The only util helper that writes.
 * Creates nothing else: no observer file, no log file, nothing under the
 * project root. Any filesystem error other than "already exists" propagates.
 */
export default async function create({ projectRoot }: { projectRoot: string }): Promise<RuntimePaths> {
	const paths = resolve({ projectRoot });

	// Recursive mkdir creates the project folder too, and is a no-op when both exist.
	await mkdir(paths.eventsFolder, { recursive: true });

	return paths;
}
