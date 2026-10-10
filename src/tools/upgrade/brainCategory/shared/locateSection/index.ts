import toMarkerPair from "@/service/brainContract/toMarkerPair/index.js";
import type { BrainSectionMarker } from "@/types/index.js";

/**
 * Returns the offsets of the bytes strictly between a section's open marker (the first one at
 * or after `bodyStart`) and the first close marker after it, or `null` when either marker is
 * absent. The span is exactly what `parseBrainAide` reports for that section, so a hash over
 * `raw.slice(start, end)` and a splice over `[start, end)` agree with the parser. The marker
 * text comes from `toMarkerPair`, the single source of marker bytes.
 */
export default function locateSection({
	raw,
	bodyStart,
	marker,
}: {
	raw: string;
	bodyStart: number;
	marker: BrainSectionMarker;
}): { start: number; end: number } | null {
	const { open, close } = toMarkerPair(marker);
	const openIndex = raw.indexOf(open, bodyStart);
	if (openIndex === -1) return null;

	const start = openIndex + open.length;
	const end = raw.indexOf(close, start);
	if (end === -1) return null;

	return { start, end };
}
