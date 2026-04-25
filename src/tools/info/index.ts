import { z } from "zod";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import readVersionsManifest from "@/tools/upgrade/buildVersionsMeta/index.js";
import buildBrainState from "@/service/buildBrainState/index.js";
import type { InfoResult } from "@/types/index.js";

export const InfoInput = z.object({});

/**
 * In dist this module lives at dist/tools/info/index.js.
 * Walking up 3 directories reaches the package root where package.json resides.
 */
const MODULE_DIR = dirname(fileURLToPath(import.meta.url));
const PACKAGE_JSON_PATH = join(MODULE_DIR, "..", "..", "..", "package.json");

/** Read the server's own npm package version from the bundled package.json. */
function readServerVersion(): string {
	try {
		const raw = readFileSync(PACKAGE_JSON_PATH, "utf-8");
		const pkg = JSON.parse(raw) as { version?: string };
		return pkg.version ?? "unknown";
	} catch {
		return "unknown";
	}
}

/**
 * Passive boot-time reporter called by the orchestrator at startup.
 *
 * Returns two independent top-level fields, each covering a distinct concern:
 *
 * - `serverVersion` + `outdated`: staleness of the host's installed AIDE
 *   artifacts against the canonical manifest shipped with this npm package.
 *   Soft notification — the pipeline can continue even when artifacts are
 *   stale. Missing `.aide/versions.json` (pre-version-tracking install)
 *   collapses silently to an empty `outdated` array.
 *
 * - `brain`: precondition state of the host's brain vault.
 *   Hard gate — the orchestrator must halt and direct the user to run `/aide`
 *   when `brain.status` is anything other than `"ok"`; the inline-recovery
 *   flow detects the broken state and prompts the user to resolve it.
 *
 * The two concerns are structurally independent: neither depends on the
 * other, and the orchestrator applies a different policy to each field.
 */
export default async function info(root: string): Promise<InfoResult> {
	// Step 1 — read the server's own package version (sync, always fast).
	const serverVersion = readServerVersion();

	// Steps 2 and 3 — staleness check and brain-state resolution are
	// independent; run them in parallel so neither blocks the other.
	// (Both involve at least one async I/O read, so parallel scheduling
	// is a meaningful latency improvement, not just cosmetic.)
	const [outdated, brain] = await Promise.all([
		resolveOutdated(root),
		buildBrainState(root),
	]);

	// Step 4 — compose the two independent fields into the unified result.
	return { serverVersion, outdated, brain };
}

/**
 * Compute the list of stale artifact keys by comparing the host's local
 * `.aide/versions.json` against the canonical manifest bundled in this
 * package. Returns an empty array silently when the local file is missing
 * (old install predating version tracking).
 */
async function resolveOutdated(root: string): Promise<string[]> {
	let localVersions: Record<string, { sourceCommit: string }> | null = null;
	try {
		const localPath = join(root, ".aide", "versions.json");
		const raw = readFileSync(localPath, "utf-8");
		localVersions = JSON.parse(raw) as Record<string, { sourceCommit: string }>;
	} catch {
		// Missing or unreadable — old install, skip silently
		return [];
	}

	const canonical = readVersionsManifest();
	const outdated: string[] = [];

	for (const key of Object.keys(canonical)) {
		const local = localVersions[key];
		if (!local || local.sourceCommit !== canonical[key].sourceCommit) {
			outdated.push(key);
		}
	}

	return outdated;
}
