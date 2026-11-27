import { parse, printParseErrorCode, type ParseError } from "jsonc-parser";
import type { ParsedHooksSettings } from "@/types/index.js";

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * Parses a Claude Code settings file (JSON with comments, trailing commas
 * allowed) for the hooks planner. Any parse error, a root that is not an
 * object, or a `hooks` value that is present and not an object yields
 * `{ ok: false, reason }`; otherwise the parsed root and its `hooks` object
 * (`{}` when the key is absent). `mergeLocal` and `stripProject` both start here,
 * so one file is judged malformed by one rule.
 */
export default function parseSettings(text: string): ParsedHooksSettings {
	const errors: ParseError[] = [];
	const settings: unknown = parse(text, errors, { allowTrailingComma: true });
	if (errors.length > 0) {
		const [first] = errors;
		return { ok: false, reason: `${printParseErrorCode(first.error)} at offset ${first.offset}` };
	}
	if (!isRecord(settings)) return { ok: false, reason: "the root is not a JSON object" };
	if (settings.hooks !== undefined && !isRecord(settings.hooks)) {
		return { ok: false, reason: "\"hooks\" is not an object" };
	}
	return { ok: true, settings, hooks: (settings.hooks ?? {}) as Record<string, unknown> };
}
