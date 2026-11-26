import { readFileSync } from "node:fs";
import { join } from "node:path";
import readVersionsManifest from "@/tools/upgrade/buildVersionsMeta/index.js";

/**
 * Compute the list of stale artifact keys by comparing the host's local
 * `.aide/versions.json` against the canonical manifest bundled in this
 * package. Returns an empty array silently when the local file is missing
 * (old install predating version tracking).
 */
export default function listStaleFiles(root: string): string[] {
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
