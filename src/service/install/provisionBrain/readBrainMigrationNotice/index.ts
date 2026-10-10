import type { BrainMigrationNotice, BrainSectionMarker } from "@/types/index.js";
import parseBrainAide from "@/service/parseBrainAide/index.js";
import detectBrainMigration from "../detectBrainMigration/index.js";

/**
 * Read a content-free summary of the brain config migration state for `aide_info` and `aide_upgrade`.
 *
 * Parses `.aide/config/brain.aide` under `projectRoot` and runs the same detection `aide_init`
 * uses, then reduces it to markers and launcher reasons only. No section text and no launcher
 * bytes leave this function, so callers can surface "a migration is available" without carrying
 * the before/after payload.
 *
 * Returns `null` when nothing is outdated or the file is absent or not safely judgeable.
 * Read-only: never writes, and every parse outcome (missing, unreadable, malformed) yields `null`.
 *
 * @param projectRoot - Host project root (where `.aide/config/brain.aide` lives).
 */
export default async function readBrainMigrationNotice(
	projectRoot: string,
): Promise<BrainMigrationNotice | null> {
	const migration = detectBrainMigration(await parseBrainAide(projectRoot));
	if (!migration) return null;

	return {
		// The offer's `marker` is widened to string by the contract entry type; findStaleSections only
		// emits entries walked from `brainContract`, so every marker is a BrainSectionMarker.
		staleSections: migration.staleSections.map((s) => s.marker as BrainSectionMarker),
		legacyLauncher: migration.legacyLauncher?.reasons ?? null,
	};
}
