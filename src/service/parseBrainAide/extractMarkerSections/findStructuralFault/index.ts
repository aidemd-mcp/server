import brainContract from "@/service/brainContract/index.js";
import toMarkerPair from "@/service/brainContract/toMarkerPair/index.js";
import type { LocatedMarker } from "@/types/index.js";

/**
 * Checks the markers that are present against the grammar and returns the
 * reason for the first structural fault, or null when the present pairs are
 * sound. Only pairs with at least one marker present are considered; a pair
 * wholly absent is not a fault here, because absence is reported separately
 * once the present sections are known to be sound.
 *
 * Checks run in this order and the first hit wins:
 * 1. half-present pair (opener without closer, or closer without opener), first in contract order;
 * 2. a closer appearing before its opener in document order;
 * 3. present openers out of contract order;
 * 4. one present section's marker nested inside another present section.
 */
export default function findStructuralFault(located: LocatedMarker[]): string | null {
	const present = brainContract
		.map((entry) => ({
			...entry,
			...toMarkerPair(entry.marker),
			opener: located.find((m) => m.marker === entry.marker && m.tokenKind === "open"),
			closer: located.find((m) => m.marker === entry.marker && m.tokenKind === "close"),
		}))
		.filter(({ opener, closer }) => opener !== undefined || closer !== undefined);

	for (const { open, close, opener, closer } of present) {
		if (opener && !closer) return `unmatched opening marker: ${open} has no matching ${close}`;
		if (!opener && closer) return `unmatched closing marker: ${close} appeared without a prior ${open}`;
	}

	const seenOpeners = new Set<string>();
	for (const { tokenKind, marker, text } of located) {
		if (tokenKind === "open") {
			seenOpeners.add(marker);
			continue;
		}
		if (!seenOpeners.has(marker)) {
			return `unmatched closing marker: ${text} appeared without a prior ${toMarkerPair(marker).open}`;
		}
	}

	const contractOrder = brainContract.map(({ marker }) => marker);
	const openersInDocumentOrder = located.filter(({ tokenKind }) => tokenKind === "open");
	for (let i = 0; i < openersInDocumentOrder.length - 1; i++) {
		const earlier = openersInDocumentOrder[i]!;
		const later = openersInDocumentOrder[i + 1]!;
		if (contractOrder.indexOf(earlier.marker) > contractOrder.indexOf(later.marker)) {
			return `marker order violation: ${earlier.text} appeared before ${later.text}`;
		}
	}

	for (const { field, marker, open, opener, closer } of present) {
		const innerStart = opener!.index + open.length;
		const innerEnd = closer!.index;
		const nested = located.find((m) => m.marker !== marker && m.index > innerStart && m.index < innerEnd);
		if (nested) return `nested marker: ${nested.text} appeared inside the ${field} section`;
	}

	return null;
}
