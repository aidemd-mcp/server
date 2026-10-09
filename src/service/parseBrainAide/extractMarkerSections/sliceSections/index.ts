import brainContract from "@/service/brainContract/index.js";
import toMarkerPair from "@/service/brainContract/toMarkerPair/index.js";
import type { BrainSectionField, LocatedMarker } from "@/types/index.js";

/**
 * Returns, for every contract field, the bytes strictly between that
 * section's opening and closing marker: verbatim, never trimmed or
 * normalized. Callers must have established that every pair is present and
 * the layout is sound; a missing marker here is a broken precondition and
 * throws rather than yielding an empty string for an absent section.
 */
export default function sliceSections({ body, located }: { body: string; located: LocatedMarker[] }): Record<BrainSectionField, string> {
	return Object.fromEntries(
		brainContract.map(({ marker, field }) => {
			const { open } = toMarkerPair(marker);
			const opener = located.find((m) => m.marker === marker && m.tokenKind === "open");
			const closer = located.find((m) => m.marker === marker && m.tokenKind === "close");
			if (!opener || !closer) throw new Error(`sliceSections called with ${open} pair incomplete`);
			return [field, body.slice(opener.index + opener.text.length, closer.index)];
		}),
	) as Record<BrainSectionField, string>;
}
