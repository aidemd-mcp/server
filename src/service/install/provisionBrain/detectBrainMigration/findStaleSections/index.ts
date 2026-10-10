import type { BrainSectionField, BrainStaleSectionOffer } from "@/types/index.js";
import brainContract from "@/service/brainContract/index.js";
import outdatedTemplateSections from "../../outdatedTemplateSections/index.js";
import fingerprintSection from "./fingerprintSection/index.js";

/**
 * Finds the existing brain sections whose text is a known outdated template
 * version, so each can be offered as its own before/after change.
 *
 * Walks the contract in order and skips any section the file does not have. A
 * section is stale only when its normalized fingerprint is recorded for its
 * marker and differs from the current template's. A section that matches no
 * recorded version is a customization and is never flagged. `before` is the
 * user's text verbatim (original line endings kept); `after` is the template's.
 * Pure: never throws and never reads from disk.
 */
export default function findStaleSections({
	sections,
	template,
}: {
	sections: Partial<Record<BrainSectionField, string>>;
	template: Record<BrainSectionField, string>;
}): BrainStaleSectionOffer[] {
	const offers: BrainStaleSectionOffer[] = [];
	for (const entry of brainContract) {
		const text = sections[entry.field];
		if (text === undefined) continue;
		const fingerprint = fingerprintSection(text);
		const knownOutdated = outdatedTemplateSections[entry.marker]?.some((version) => version.fingerprint === fingerprint);
		if (!knownOutdated) continue;
		if (fingerprint === fingerprintSection(template[entry.field])) continue;
		offers.push({ ...entry, before: text, after: template[entry.field] });
	}
	return offers;
}
