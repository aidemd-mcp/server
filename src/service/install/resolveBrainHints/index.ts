import { access } from "node:fs/promises";
import { join, dirname } from "node:path";
import { homedir } from "node:os";
import type { BrainHint } from "@/types/index.js";

/** Check if a path exists on disk. */
async function exists(path: string): Promise<boolean> {
	try {
		await access(path);
		return true;
	} catch {
		return false;
	}
}

/**
 * Discover all candidate brain vault locations and return them as hints.
 *
 * Checks three sources in order:
 * 1. AIDE_BRAIN_PATH environment variable
 * 2. Sibling my-brain/ directory next to projectRoot
 * 3. Platform-conventional location: ~/my-brain
 *
 * Returns every candidate that exists on disk. Returns an empty array when
 * none are found — the agent must then ask the user directly.
 *
 * The caller (agent) presents these hints as suggestions and asks the user
 * to confirm or provide a different path. The hints are never silently
 * adopted — this function reports candidates, not a winner.
 */
export default async function resolveBrainHints(projectRoot: string): Promise<BrainHint[]> {
	const hints: BrainHint[] = [];

	const envPath = process.env.AIDE_BRAIN_PATH;
	if (envPath && await exists(envPath)) {
		hints.push({ source: "env", path: envPath });
	}

	const siblingPath = join(dirname(projectRoot), "my-brain");
	if (await exists(siblingPath)) {
		hints.push({ source: "sibling", path: siblingPath });
	}

	const conventionalPath = join(homedir(), "my-brain");
	if (await exists(conventionalPath)) {
		hints.push({ source: "conventional", path: conventionalPath });
	}

	return hints;
}
