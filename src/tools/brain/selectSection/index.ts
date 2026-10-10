import brainContract from "@/service/brainContract/index.js";
import type { BrainSectionMarker } from "@/service/brainContract/index.js";
import type { ParseBrainAideResult } from "@/types/index.js";

/**
 * Picks the requested section's verbatim bytes out of the parser's result.
 * The marker maps to its parsed field through the `brainContract` entry, never
 * a per-marker switch. An `ok` parse carries every section; a
 * `missing-sections` parse carries only the `present` ones; every other kind
 * has nothing trustworthy to slice. The bytes are returned exactly as the
 * parser extracted them: no trim, no CRLF normalization, no substitution.
 */
export default function selectSection({
	parse,
	marker,
}: {
	parse: ParseBrainAideResult;
	marker: BrainSectionMarker;
}): string | undefined {
	const entry = brainContract.find((candidate) => candidate.marker === marker);
	if (!entry) throw new Error(`No brainContract entry for section marker "${marker}"`);
	if (parse.kind === "ok") return parse[entry.field];
	if (parse.kind === "missing-sections") return parse.present[entry.field];
	return undefined;
}
