import type { BrainSectionRepair, ParseBrainAideResult } from "@/types/index.js";
import brainContract from "@/service/brainContract/index.js";
import toMarkerPair from "@/service/brainContract/toMarkerPair/index.js";
import parseBundledTemplate from "../parseBundledTemplate/index.js";

/**
 * Plan the insertion-only repair for an outdated brain config.
 *
 * Applies only when the user's `.aide/config/brain.aide` parses to `missing-sections`
 * (every present marker pair is sound, one or more whole pairs are absent). Any other
 * parse result (`ok`, `missing`, `unreadable`, `malformed-frontmatter`, `malformed-body`)
 * returns `undefined`: there is nothing to add, or the file is not safely repairable by insertion.
 *
 * The missing sections' bytes come only from the latest bundled template. The contract is
 * walked in order with a running anchor that starts at `null` (start of the body). A present
 * section moves the anchor to its close marker; a missing section emits a repair entry whose
 * `block` is the marker-wrapped template section and whose `insertAfter` is the current anchor,
 * then moves the anchor to its own close marker. The consumer applies the entries in array
 * order under provisionBrain brief commitment #6.
 *
 * Consumer: aide_upgrade's brain insertion, which parses the user's file once and hands the
 * parse here. Read-only and pure: no filesystem access, the parse and the in-memory template
 * are the only inputs, nothing is written.
 *
 * @param userParse - The parse of the user's `.aide/config/brain.aide`.
 * @throws An error named `BundledTemplateIntegrityError` when the bundled template does not
 *   parse `ok` (raised by `parseBundledTemplate`). That is a programming error, guarded by the
 *   template's own completeness test.
 */
export default function planBrainRepair(
	userParse: ParseBrainAideResult,
): BrainSectionRepair[] | undefined {
	if (userParse.kind !== "missing-sections") return undefined;

	const templateParse = parseBundledTemplate();

	const missing = new Set<string>(userParse.sections);
	const repairs: BrainSectionRepair[] = [];
	let anchor: string | null = null;

	for (const entry of brainContract) {
		const { open, close } = toMarkerPair(entry.marker);
		if (missing.has(entry.marker)) {
			repairs.push({
				...entry,
				block: open + templateParse[entry.field] + close,
				insertAfter: anchor,
			});
		}
		anchor = close;
	}

	return repairs;
}
