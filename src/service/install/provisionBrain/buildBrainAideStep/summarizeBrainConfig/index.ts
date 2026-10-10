import type { BrainSectionMarker, BrainStepSummary, ParseBrainAideResult } from "@/types/index.js";
import detectBrainMigration from "../../detectBrainMigration/index.js";
import isTemplateIntegration from "../../isTemplateIntegration/index.js";
import listBrainSections from "./listBrainSections/index.js";

/**
 * Reduces an already-parsed brain.aide to the content-free `brainSummary` the install summary carries.
 *
 * Always lists the contract sections. Findings are reported only for a judgeable file (`ok` or
 * `missing-sections`): the missing markers, the stale section markers, the legacy launcher
 * reasons, and whether the launcher is the bundled template's integration. A would-create step
 * (`null` parse) and any absent, unreadable or malformed file report empty findings with
 * `templateIntegration: null`; aide_info carries the fault. Pure: the caller supplies the parse,
 * and no section or launcher bytes ever enter the result.
 *
 * @param parse - The parse of the existing brain.aide, or `null` when the file does not exist yet.
 */
export default function summarizeBrainConfig(parse: ParseBrainAideResult | null): BrainStepSummary {
	const sections = listBrainSections();

	// 1. Only a file with usable sections and launcher can be judged.
	if (parse === null || (parse.kind !== "ok" && parse.kind !== "missing-sections")) {
		return { sections, missingSections: [], staleSections: [], legacyLauncher: null, templateIntegration: null };
	}

	// 2. Reduce the migration offers to markers and reasons; the bytes stay with aide_upgrade.
	const migration = detectBrainMigration(parse);
	return {
		sections,
		missingSections: parse.kind === "missing-sections" ? parse.sections : [],
		// The offer's `marker` is widened to string by the contract entry type; findStaleSections only
		// emits entries walked from `brainContract`, so every marker is a BrainSectionMarker.
		staleSections: migration?.staleSections.map((offer) => offer.marker as BrainSectionMarker) ?? [],
		legacyLauncher: migration?.legacyLauncher?.reasons ?? null,
		templateIntegration: isTemplateIntegration(parse.mcpServerConfig),
	};
}
