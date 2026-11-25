import { mkdir } from "node:fs/promises";
import type { RuntimePaths } from "../types/index.js";
import resolve from "../resolve/index.js";

/**
 * Create a project's per-user runtime folder with its events, presence and
 * ended folders when missing, then return the resolved paths. The only util
 * helper that writes. Creates nothing else: no observer file, no log file, no
 * presence record, nothing under the project root. Any filesystem error other
 * than "already exists" propagates.
 */
export default async function create({ projectRoot }: { projectRoot: string }): Promise<RuntimePaths> {
	const paths = resolve({ projectRoot });

	// Recursive mkdir creates the project folder too, and is a no-op when each exists.
	await mkdir(paths.eventsFolder, { recursive: true });
	await mkdir(paths.presenceFolder, { recursive: true });
	await mkdir(paths.endedFolder, { recursive: true });

	return paths;
}
