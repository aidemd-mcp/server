import { parse } from "yaml";
import type { AideFrontmatter } from "@/types/index.js";

/** Parsed result of a raw .aide file string. */
export interface ParseFrontmatterResult {
	frontmatter: AideFrontmatter | null;
	body: string;
	/** When YAML parsing fails, contains the parser error message. */
	parseError?: string;
}

/** Extract the YAML block between the first pair of `---` delimiters. Returns null when no block is found. */
function extractYamlBlock(raw: string): { yaml: string; rest: string } | null {
	const trimmed = raw.trimStart();
	if (!trimmed.startsWith("---")) return null;

	const afterOpen = trimmed.slice(3);
	const closeIndex = afterOpen.indexOf("\n---");
	if (closeIndex === -1) return null;

	const yaml = afterOpen.slice(0, closeIndex).trim();
	const rest = afterOpen.slice(closeIndex + 4).replace(/^\n/, "");
	return { yaml, rest };
}

/** Coerce a parsed YAML value into a string array, returning an empty array on failure. */
function toStringArray(value: unknown): string[] {
	if (!Array.isArray(value)) return [];
	return value.filter((v): v is string => typeof v === "string");
}

/** Coerce raw parsed YAML into a well-typed AideFrontmatter, tolerating missing fields. */
function coerceFrontmatter(raw: unknown): AideFrontmatter {
	if (!raw || typeof raw !== "object") return {};
	const obj = raw as Record<string, unknown>;

	const fm: AideFrontmatter = {};
	if (typeof obj.scope === "string") fm.scope = obj.scope;
	if (typeof obj.description === "string") fm.description = obj.description;
	if (typeof obj.intent === "string") fm.intent = obj.intent;
	if (obj.status === "aligned" || obj.status === "misaligned") fm.status = obj.status;

	if (obj.outcomes && typeof obj.outcomes === "object") {
		const outcomes = obj.outcomes as Record<string, unknown>;
		fm.outcomes = {
			desired: toStringArray(outcomes.desired),
			undesired: toStringArray(outcomes.undesired),
		};
	}

	return fm;
}

/**
 * Parse YAML frontmatter and body from a raw .aide file string.
 * Returns `{ frontmatter: null, body: raw }` when no `---` block is present.
 * Missing `outcomes` fields default to empty arrays rather than throwing.
 */
export default function parseFrontmatter(raw: string): ParseFrontmatterResult {
	const block = extractYamlBlock(raw);
	if (!block) return { frontmatter: null, body: raw };

	let parsed: unknown;
	try {
		parsed = parse(block.yaml);
	} catch (err) {
		return {
			frontmatter: null,
			body: raw,
			parseError: err instanceof Error ? err.message : String(err),
		};
	}

	return {
		frontmatter: coerceFrontmatter(parsed),
		body: block.rest,
	};
}
