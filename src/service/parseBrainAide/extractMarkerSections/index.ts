import brainContract from "@/service/brainContract/index.js";
import type { SectionExtraction } from "@/types/index.js";
import findStructuralFault from "./findStructuralFault/index.js";
import findUnknownMarker from "./findUnknownMarker/index.js";
import locateMarkers from "./locateMarkers/index.js";
import slicePresentSections from "./slicePresentSections/index.js";
import sliceSections from "./sliceSections/index.js";

/**
 * Walks the brain.aide body against the required-section contract and returns
 * every section's bytes, or the precise reason it cannot.
 *
 * Pipeline, each step short-circuiting:
 * 1. a marker-like token that is not a contract marker -> malformed-body (`unknown marker`);
 * 2. locate every contract marker in document order;
 * 3. a structural fault among the present pairs -> malformed-body;
 * 4. any contract pair wholly absent -> missing-sections, in contract order, carrying
 *    the verbatim bytes of every section that is present;
 * 5. otherwise slice every section verbatim -> ok.
 *
 * Structural faults are always reported before absence, so a `missing-sections`
 * result guarantees everything present is sound and the file is safe to repair
 * by inserting the absent sections. Bytes outside any pair are ignored.
 */
export default function extractMarkerSections(body: string): SectionExtraction {
	const unknownMarker = findUnknownMarker(body);
	if (unknownMarker !== null) return { kind: "malformed-body", reason: `unknown marker: ${unknownMarker}` };

	const located = locateMarkers(body);

	const fault = findStructuralFault(located);
	if (fault !== null) return { kind: "malformed-body", reason: fault };

	const sections = brainContract.map(({ marker }) => marker).filter((marker) => !located.some((m) => m.marker === marker));
	if (sections.length > 0) return { kind: "missing-sections", sections, present: slicePresentSections({ body, located }) };

	return { kind: "ok", ...sliceSections({ body, located }) };
}
