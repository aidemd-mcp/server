import { detectBrainMigration, isTemplateIntegration } from "@/service/install/provisionBrain/index.js";
import type { BrainChangeOffer, BrainSectionMarker, ParseBrainAideResult } from "@/types/index.js";
import changedSinceDiff from "../../changedSinceDiff/index.js";
import locateFrontmatter from "../../locateFrontmatter/index.js";
import locateSection from "../../locateSection/index.js";
import readChangeBefore from "../../readChangeBefore/index.js";
import toLineEnding from "../../toLineEnding/index.js";

/**
 * Builds the offer to replace one stale brain config section with the latest bundled
 * template's version, or the refusal that explains why none is offered:
 *
 * - section absent from the file -> R9 (there is no text to guard or replace)
 * - not a known outdated template version (current or customized) -> R5
 * - stale, but the config launches a different brain server than the template targets -> R6
 *
 * Only `detectBrainMigration` decides staleness, so a customized section is never offered.
 * `after` is the template section converted to the file's line ending; `text` is `raw` with
 * exactly the bytes between the section's markers replaced by `after`. Pure.
 */
export default function buildSectionOffer({
	raw,
	parse,
	marker,
	eol,
}: {
	raw: string;
	parse: ParseBrainAideResult;
	marker: BrainSectionMarker;
	eol: "\r\n" | "\n";
}): BrainChangeOffer {
	if (parse.kind !== "ok" && parse.kind !== "missing-sections") {
		throw new Error(`buildSectionOffer requires a usable parse, got: ${parse.kind}`);
	}

	// 1. The bytes to replace; none means the section vanished.
	const before = readChangeBefore({ raw, target: marker });
	if (before === null) {
		return {
			kind: "refused",
			instructions: changedSinceDiff(marker),
		};
	}

	// 2. Only a known outdated template version is ever offered.
	const stale = detectBrainMigration(parse)?.staleSections.find((offer) => offer.marker === marker);
	if (!stale) {
		return {
			kind: "refused",
			instructions: `Section \`${marker}\` matches no outdated template version (it is current or customized), so no change is offered.`,
		};
	}

	// 3. Verbatim template text may only land in the template's own integration.
	if (!isTemplateIntegration(parse.mcpServerConfig)) {
		return {
			kind: "refused",
			instructions: `Section \`${marker}\` is an outdated template version, but this config launches a different brain server than the bundled template targets, so the template's text is not offered. Review it with the user by hand.`,
		};
	}

	// 4. Splice the converted template text over exactly the section's span.
	const span = locateSection({ raw, bodyStart: locateFrontmatter(raw).bodyStart, marker });
	if (!span) throw new Error(`buildSectionOffer lost the ${marker} section between reading and splicing it`);
	const after = toLineEnding({ text: stale.after, eol });
	return {
		kind: "offer",
		target: marker,
		before,
		after,
		text: raw.slice(0, span.start) + after + raw.slice(span.end),
	};
}
