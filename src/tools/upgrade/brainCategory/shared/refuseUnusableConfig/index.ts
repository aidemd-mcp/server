import type { BrainCategoryResult, ParseBrainAideResult } from "@/types/index.js";

/**
 * Returns the refusal for a brain.aide the brain category cannot change, or `null` when the
 * parse is usable (`ok` or `missing-sections`).
 *
 * - `missing` -> R1: the file is absent, so creating it is `/aide:brain config`'s job (the only
 *   string that names that command, which is safe because there is no file to loop on).
 * - `unreadable` / `malformed-frontmatter` / `malformed-body` -> R2 with the parser's `reason`
 *   verbatim.
 *
 * Exact wording is pinned by the upgrade brief (#17).
 */
export default function refuseUnusableConfig(parse: ParseBrainAideResult): BrainCategoryResult | null {
	switch (parse.kind) {
		case "missing":
			return {
				outcome: "refused",
				instructions:
					"No `.aide/config/brain.aide` exists, so nothing was written. Run `/aide:brain config` to create it.",
			};
		case "unreadable":
		case "malformed-frontmatter":
		case "malformed-body":
			return {
				outcome: "refused",
				instructions: `\`.aide/config/brain.aide\` cannot be changed by the tool: ${parse.reason}. Nothing was written. Fix it by hand with the user at the place that reason names, then re-check brain state with \`aide_info\`.`,
			};
		case "ok":
		case "missing-sections":
			return null;
	}
}
