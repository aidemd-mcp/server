import type { BrainSectionRepair } from "@/types/index.js";
import brainContract from "@/service/brainContract/index.js";
import toMarkerPair from "@/service/brainContract/toMarkerPair/index.js";
import parseBrainAide, { parseBrainAideFromString } from "@/service/parseBrainAide/index.js";
import obsidianBrainAideTemplate from "../../obsidianBrainAideTemplate/index.js";

/**
 * Plan the insertion-only repair for an outdated brain config.
 *
 * Applies only when the user's `.aide/config/brain.aide` parses to `missing-sections`
 * (every present marker pair is sound, one or more whole pairs are absent). Any other
 * parse result (`ok`, `missing`, `malformed-frontmatter`, `malformed-body`) returns
 * `undefined`: there is nothing to add, or the file is not safely repairable by insertion.
 *
 * The missing sections' bytes come only from the latest bundled template. The contract is
 * walked in order with a running anchor that starts at `null` (start of the body). A present
 * section moves the anchor to its close marker; a missing section emits a repair entry whose
 * `block` is the marker-wrapped template section and whose `insertAfter` is the current anchor,
 * then moves the anchor to its own close marker. The consumer applies the entries in array
 * order under provisionBrain brief commitment #6.
 *
 * Read-only: reads the user's file (through the parser) and the in-memory template, writes nothing.
 *
 * @throws An error named `BundledTemplateIntegrityError` when the bundled template does not
 *   parse `ok`. That is a programming error, guarded by the template's own completeness test.
 */
export default async function planBrainRepair(
	projectRoot: string,
): Promise<BrainSectionRepair[] | undefined> {
	const userParse = await parseBrainAide(projectRoot);
	if (userParse.kind !== "missing-sections") return undefined;

	const templateParse = parseBrainAideFromString(obsidianBrainAideTemplate());
	if (templateParse.kind !== "ok") {
		const error = new Error(
			`Bundled brain.aide template failed to parse (${templateParse.kind}); it must satisfy the full section contract.`,
		);
		error.name = "BundledTemplateIntegrityError";
		throw error;
	}

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
