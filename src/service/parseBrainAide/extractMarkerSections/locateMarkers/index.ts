import brainContract from "@/service/brainContract/index.js";
import toMarkerPair from "@/service/brainContract/toMarkerPair/index.js";
import type { LocatedMarker } from "@/types/index.js";

/** Returns every index at which `text` occurs in `body`, including overlapping starts, in ascending order. */
function findAllIndexes({ body, text }: { body: string; text: string }): number[] {
	const indexes: number[] = [];
	let index = body.indexOf(text);
	while (index !== -1) {
		indexes.push(index);
		index = body.indexOf(text, index + 1);
	}
	return indexes;
}

/**
 * Scans the body for every opening and closing marker of every contract
 * section and returns all occurrences in document order. The pair list comes
 * from the contract through `toMarkerPair`, so a section added to the contract
 * is located with no change here. Pure byte matching: it neither validates
 * nor interprets what it finds.
 */
export default function locateMarkers(body: string): LocatedMarker[] {
	return brainContract
		.flatMap(({ marker }) => {
			const { open, close } = toMarkerPair(marker);
			return [
				...findAllIndexes({ body, text: open }).map((index): LocatedMarker => ({ tokenKind: "open", marker, text: open, index })),
				...findAllIndexes({ body, text: close }).map((index): LocatedMarker => ({ tokenKind: "close", marker, text: close, index })),
			];
		})
		.sort((a, b) => a.index - b.index);
}
