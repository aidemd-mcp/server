import { z } from "zod";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import readVersionsManifest from "@/tools/upgrade/buildVersionsMeta/index.js";
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
 * Passive staleness-detection surface called during orchestrator boot.
 * Reads the host project's .aide/versions.json from disk, compares each
 * artifact's sourceCommit against the canonical manifest shipped inside the
 * npm package, and returns a structured staleness report. If the local
 * versions file is missing or unreadable (old install predating version
 * tracking), returns an empty outdated array silently.
 */
export default async function info(root: string): Promise<InfoResult> {
	const serverVersion = readServerVersion();

	let localVersions: Record<string, { sourceCommit: string }> | null = null;
	try {
		const localPath = join(root, ".aide", "versions.json");
		const raw = readFileSync(localPath, "utf-8");
		localVersions = JSON.parse(raw) as Record<string, { sourceCommit: string }>;
	} catch {
		// Missing or unreadable — old install, skip silently
		return { serverVersion, outdated: [] };
	}

	const canonical = readVersionsManifest();
	const outdated: string[] = [];

	for (const key of Object.keys(canonical)) {
		const local = localVersions[key];
		if (!local || local.sourceCommit !== canonical[key].sourceCommit) {
			outdated.push(key);
		}
	}

	return { serverVersion, outdated };
}
