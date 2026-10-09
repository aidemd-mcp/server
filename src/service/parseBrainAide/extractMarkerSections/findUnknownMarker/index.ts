import brainContract from "@/service/brainContract/index.js";
import toMarkerPair from "@/service/brainContract/toMarkerPair/index.js";

/** Escapes regex metacharacters so a contract marker name can be spliced into a pattern as literal text. */
function escapeRegex(text: string): string {
	return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Retired section vocabulary. These tokens name sections that no longer exist,
 * so they are plain bytes rather than current sections; a file still carrying
 * them is reported as missing the current sections, not as holding an unknown
 * marker. This is history, not a restatement of the contract.
 */
const RETIRED_MARKER_REGEX = /<!--\s*aide-(?:prose|playbook|research)-(?:start|end)\s*-->/i;

/**
 * Finds the earliest HTML-comment token that looks like a section marker but
 * is not an exact contract marker, and returns it exactly as written, or null
 * when there is none. This catches uppercase and mixed-case variants, missing
 * or extra whitespace, typos, and a dropped `aide-` prefix.
 *
 * Two candidate patterns, both built from the contract's marker names:
 * A matches aide-prefixed tokens that name a section or a start/end keyword;
 * B matches tokens that begin with a section name and carry a start/end keyword,
 * which catches the dropped-prefix class while leaving generic comments alone.
 *
 * Bytes inside the content span of a complete recognized pair are plain bytes
 * and are never flagged, so a user's own comment between a section's markers
 * is not an error. An incomplete pair has no span to exclude, so a typo'd
 * marker standing in for a real one is still caught.
 */
export default function findUnknownMarker(body: string): string | null {
	const pairs = brainContract.map(({ marker }) => toMarkerPair(marker));
	const recognized = new Set(pairs.flatMap(({ open, close }) => [open, close]));

	const exclusionSpans = pairs.flatMap(({ open, close }) => {
		const openIndex = body.indexOf(open);
		const closeIndex = body.indexOf(close);
		return openIndex !== -1 && closeIndex !== -1 && openIndex < closeIndex
			? [{ start: openIndex + open.length, end: closeIndex }]
			: [];
	});

	const names = brainContract.map(({ marker }) => escapeRegex(marker)).join("|");
	const candidatePatterns = [
		new RegExp(`<!--[^>]*aide[^>]*(?:${names}|start|end)[^>]*-->`, "gi"),
		new RegExp(`<!--\\s*(?:${names})[^>]*(?:start|end)[^>]*-->`, "gi"),
	];

	const offenders = candidatePatterns
		.flatMap((pattern) => [...body.matchAll(pattern)].map((match) => ({ text: match[0], index: match.index ?? 0 })))
		.filter(({ text }) => !recognized.has(text))
		.filter(({ index }) => !exclusionSpans.some(({ start, end }) => index > start && index < end))
		.filter(({ text }) => !RETIRED_MARKER_REGEX.test(text))
		.sort((a, b) => a.index - b.index);

	return offenders[0]?.text ?? null;
}
