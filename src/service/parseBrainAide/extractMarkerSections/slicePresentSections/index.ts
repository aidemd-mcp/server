import brainContract from "@/service/brainContract/index.js";
import type { BrainSectionField, LocatedMarker } from "@/types/index.js";

/**
 * Returns the bytes strictly between the opening and closing marker of every
 * contract section whose pair is present: verbatim, never trimmed or
 * normalized, exactly as `sliceSections` slices them. Sections whose pair is
 * absent are left out of the record entirely; no key is ever set to `""` or
 * `undefined`.
 *
 * It exists because absence is reported separately (`sections` on
 * `missing-sections`), while consumers that judge existing sections, such as
 * migration detection on an old-shape brain config, still need the present
 * bytes. Callers have already ruled out structural faults, so every pair that
 * is present is whole. It never throws.
 */
export default function slicePresentSections({ body, located }: { body: string; located: LocatedMarker[] }): Partial<Record<BrainSectionField, string>> {
	const present: Partial<Record<BrainSectionField, string>> = {};
	for (const { marker, field } of brainContract) {
		const opener = located.find((m) => m.marker === marker && m.tokenKind === "open");
		const closer = located.find((m) => m.marker === marker && m.tokenKind === "close");
		if (opener && closer) present[field as BrainSectionField] = body.slice(opener.index + opener.text.length, closer.index);
	}
	return present;
}
