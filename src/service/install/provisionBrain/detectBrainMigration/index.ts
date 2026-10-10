import type { BrainMigration, BrainSectionField, ParseBrainAideResult } from "@/types/index.js";
import brainContract from "@/service/brainContract/index.js";
import parseBundledTemplate from "../parseBundledTemplate/index.js";
import findLegacyLauncher from "./findLegacyLauncher/index.js";
import findStaleSections from "./findStaleSections/index.js";

/**
 * Detects brain config migration for an already-parsed brain.aide, read-only.
 *
 * Two things count: existing sections whose text is a known outdated template
 * version, and a legacy bundled-mcpvault npx launcher. Customizations and custom
 * launchers are never flagged. Pure: no fs and no writes, so nothing here can
 * change the user's file. Every result is an offer the agent applies only on the
 * user's yes to that one change; skip is the default.
 *
 * @returns The offers, or null when the parse is not judgeable or nothing is outdated.
 */
export default function detectBrainMigration(brain: ParseBrainAideResult): BrainMigration | null {
	// 1. Only a file with usable sections and launcher can be judged safely.
	if (brain.kind !== "ok" && brain.kind !== "missing-sections") return null;

	// 2. Take whichever sections the file has.
	const sections: Partial<Record<BrainSectionField, string>> =
		brain.kind === "ok" ? Object.fromEntries(brainContract.map((entry) => [entry.field, brain[entry.field]])) : brain.present;

	// 3. The latest bundled template is what each stale section is offered against.
	const template = parseBundledTemplate();

	// 4. Sections recognised as known outdated template versions.
	const staleSections = findStaleSections({ sections, template });

	// 5. A legacy npx launcher, if any.
	const legacyLauncher = findLegacyLauncher(brain.mcpServerConfig);

	// 6. Nothing outdated means no offer.
	if (staleSections.length === 0 && legacyLauncher === null) return null;
	return { staleSections, legacyLauncher };
}
