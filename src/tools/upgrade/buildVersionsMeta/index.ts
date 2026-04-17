import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/** Git-derived version metadata for a single deliverable artifact. */
export interface VersionMeta {
	/** ISO 8601 author timestamp of the last commit touching this artifact. */
	publishedAt: string;
	/** 7-char short SHA of the last commit touching this artifact. */
	sourceCommit: string;
	/** 7-char short SHA of the prior commit touching this artifact, if one exists. */
	previousCommit?: string;
}

/** Map of artifact slug → version metadata. */
export type VersionsMap = Record<string, VersionMeta>;

/**
 * Path to the static versions.json manifest baked into the published package.
 *
 * In dist this module lives at dist/tools/upgrade/buildVersionsMeta/index.js.
 * Walking up 3 directories reaches dist/, where versions.json resides.
 */
const MODULE_DIR = dirname(fileURLToPath(import.meta.url));
const VERSIONS_PATH = join(MODULE_DIR, "..", "..", "..", "versions.json");

/**
 * Read the static versions.json manifest shipped with this package. Returns a
 * VersionsMap keyed by artifact slug. If the file is missing (e.g. running
 * from source before a build), returns an empty object and warns to stderr.
 */
export default function readVersionsManifest(): VersionsMap {
	try {
		const raw = readFileSync(VERSIONS_PATH, "utf-8");
		return JSON.parse(raw) as VersionsMap;
	} catch {
		console.warn(
			"[aide] versions.json not found — run `npm run build` to generate it.",
		);
		return {};
	}
}
