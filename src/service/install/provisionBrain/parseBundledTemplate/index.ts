import type { ParseBrainAideResult } from "@/types/index.js";
import { parseBrainAideFromString } from "@/service/parseBrainAide/index.js";
import obsidianBrainAideTemplate from "../obsidianBrainAideTemplate/index.js";

/**
 * Parse the bundled brain.aide template once and hand back the `ok` result.
 *
 * Migration detection compares the user's sections against the latest template's
 * sections. Section text does not depend on the launch mode (only the frontmatter
 * branches), so the default mode is parsed.
 *
 * @throws An error named `BundledTemplateIntegrityError` when the bundled template does not
 *   parse `ok`. That is a programming error, guarded by the template's own completeness test.
 */
export default function parseBundledTemplate(): Extract<ParseBrainAideResult, { kind: "ok" }> {
	const templateParse = parseBrainAideFromString(obsidianBrainAideTemplate());
	if (templateParse.kind !== "ok") {
		const error = new Error(
			`Bundled brain.aide template failed to parse (${templateParse.kind}); it must satisfy the full section contract.`,
		);
		error.name = "BundledTemplateIntegrityError";
		throw error;
	}
	return templateParse;
}
