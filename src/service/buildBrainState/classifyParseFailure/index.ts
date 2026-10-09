import type { BrainAideFault, ParseBrainAideResult } from "@/types/index.js";

/**
 * The one place where a parse failure becomes a boot fault. Maps every non-ok
 * `parseBrainAide` result to the `BrainAideFault` carried on the
 * `brain-aide-invalid` status, or to `null` when the file is simply absent
 * (absence is `no-brain-aide`, never a fault).
 *
 * - `missing` -> `null`.
 * - `missing-sections` -> `{ kind: "missing-sections", sections }`, the parser's array passed through unchanged.
 * - `unreadable` / `malformed-frontmatter` / `malformed-body` -> `{ kind: "malformed", reason }`, `reason` verbatim from the parser.
 *   A present-but-unreadable file is a fault, never absence.
 *
 * tools/brain reuses this for its defensive fallback so the mapping is never re-derived.
 */
export default function classifyParseFailure(
	parse: Exclude<ParseBrainAideResult, { kind: "ok" }>,
): BrainAideFault | null {
	switch (parse.kind) {
		case "missing":
			return null;
		case "missing-sections":
			return { kind: "missing-sections", sections: parse.sections };
		case "unreadable":
		case "malformed-frontmatter":
		case "malformed-body":
			return { kind: "malformed", reason: parse.reason };
		default: {
			const unreachable: never = parse;
			throw new Error(`Unhandled parse result: ${JSON.stringify(unreachable)}`);
		}
	}
}
