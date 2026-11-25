import { applyEdits, format, modify, parse, printParseErrorCode, type FormattingOptions, type ParseError } from "jsonc-parser";
import type { HookEventName } from "@/types/index.js";
import aideHookEntries from "./aideHookEntries/index.js";
import findWiredEvents from "./findWiredEvents/index.js";

export type HooksMergePlan =
	| { state: "absent"; merged: string }
	| { state: "complete" }
	| { state: "missing"; events: HookEventName[]; merged: string }
	| { state: "malformed"; reason: string };

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null && !Array.isArray(value);

/** Indent unit from the first indented line (tabs or spaces); two spaces when none. */
function detectFormatting(text: string): FormattingOptions {
	const eol = /\r\n/.test(text.split("\n", 1)[0] ?? "") ? "\r\n" : "\n";
	const indent = /^([ \t]+)\S/m.exec(text)?.[1];
	if (indent === undefined) return { insertSpaces: true, tabSize: 2, eol };
	if (indent.startsWith("\t")) return { insertSpaces: false, tabSize: 1, eol };
	return { insertSpaces: true, tabSize: indent.length, eol };
}

/**
 * Plans AIDE's hook entries in a Claude Code `.claude/settings.json`.
 *
 * `text` is the file's content, or `null` when it does not exist. A missing
 * (or blank) file yields a new file holding only the `hooks` object. Otherwise
 * the file is parsed as JSON-with-comments, and only the unwired events'
 * matcher groups are inserted as `jsonc-parser` edits, so every byte outside
 * the inserted ranges is unchanged. Planning the merged text again yields
 * `complete`.
 */
export default function planHooksMerge({ text }: { text: string | null }): HooksMergePlan {
	if (text === null || text.trim() === "") {
		const hooks = Object.fromEntries(aideHookEntries.map(({ event, group }) => [event, [group]]));
		return { state: "absent", merged: `${JSON.stringify({ hooks }, null, 2)}\n` };
	}

	const errors: ParseError[] = [];
	const settings: unknown = parse(text, errors, { allowTrailingComma: true });
	if (errors.length > 0) {
		const [first] = errors;
		return { state: "malformed", reason: `${printParseErrorCode(first.error)} at offset ${first.offset}` };
	}
	if (!isRecord(settings)) return { state: "malformed", reason: "the root is not a JSON object" };
	if (settings.hooks !== undefined && !isRecord(settings.hooks)) {
		return { state: "malformed", reason: "\"hooks\" is not an object" };
	}
	const hooks = (settings.hooks ?? {}) as Record<string, unknown>;
	const wronglyShaped = aideHookEntries.find(({ event }) => hooks[event] !== undefined && !Array.isArray(hooks[event]));
	if (wronglyShaped) return { state: "malformed", reason: `"hooks.${wronglyShaped.event}" is not an array` };

	const wired = findWiredEvents(settings);
	const missing = aideHookEntries.filter(({ event }) => !wired.has(event));
	if (missing.length === 0) return { state: "complete" };

	const formattingOptions = detectFormatting(text);
	let merged = text;
	for (const { event, group } of missing) {
		const [insertion] = modify(merged, ["hooks", event, -1], group, {});
		merged = applyEdits(merged, [insertion]);
		// Format only the inserted range, so the user's own bytes are never reflowed.
		const range = { offset: insertion.offset, length: insertion.content.length };
		merged = applyEdits(merged, format(merged, range, formattingOptions));
	}
	return { state: "missing", events: missing.map(({ event }) => event), merged };
}
