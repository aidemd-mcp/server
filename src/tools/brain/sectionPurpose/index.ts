import brainContract from "@/service/brainContract/index.js";
import type { BrainSectionMarker } from "@/service/brainContract/index.js";

/**
 * Looks up the one-line purpose of a brain config section from the published
 * `brainContract` entry whose marker matches. The string is returned untouched
 * and is never read from the user's brain.aide, so the user's prose cannot
 * redefine the contract. Because `BrainInput.kind` is derived from the same
 * contract a matching entry always exists; the throw is an exhaustiveness
 * guard for a marker that escaped the schema.
 */
export default function sectionPurpose(marker: BrainSectionMarker): string {
	const entry = brainContract.find((candidate) => candidate.marker === marker);
	if (!entry) throw new Error(`No brainContract entry for section marker "${marker}"`);
	return entry.purpose;
}
