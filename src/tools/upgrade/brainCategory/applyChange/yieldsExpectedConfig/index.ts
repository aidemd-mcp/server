import { isDeepStrictEqual } from "node:util";
import brainContract from "@/service/brainContract/index.js";
import { detectBrainMigration } from "@/service/install/provisionBrain/index.js";
import { parseBrainAideFromString } from "@/service/parseBrainAide/index.js";
import type { BrainChangeOffer, ParseBrainAideResult } from "@/types/index.js";

/**
 * Brief #16: the offer's spliced text parses to the same kind as the file did and carries the
 * change. A section's parsed bytes must equal `offer.after`; the launcher's `mcpServerConfig`
 * must deep-equal the legacy launcher offer's `after`.
 */
export default function yieldsExpectedConfig({
	parse,
	offer,
}: {
	parse: ParseBrainAideResult;
	offer: Extract<BrainChangeOffer, { kind: "offer" }>;
}): boolean {
	const spliced = parseBrainAideFromString(offer.text);
	if (spliced.kind !== parse.kind) return false;
	if (spliced.kind !== "ok" && spliced.kind !== "missing-sections") return false;

	if (offer.target === "launcher") {
		const expected = detectBrainMigration(parse)?.legacyLauncher?.after;
		return expected !== undefined && isDeepStrictEqual(spliced.mcpServerConfig, expected);
	}

	const entry = brainContract.find(({ marker }) => marker === offer.target);
	if (!entry) throw new Error(`applyChange target ${offer.target} is not in the brain contract`);
	const written = spliced.kind === "ok" ? spliced[entry.field] : spliced.present[entry.field];
	return written === offer.after;
}
