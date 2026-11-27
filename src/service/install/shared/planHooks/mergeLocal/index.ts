import { applyEdits, format, modify, type FormattingOptions } from "jsonc-parser";
import type { LocalHooksPlan } from "@/types/index.js";
import aideHookEntries from "./aideHookEntries/index.js";
import buildCommand from "./buildCommand/index.js";
import findWiredEvents from "./findWiredEvents/index.js";
import parseSettings from "../shared/parseSettings/index.js";
import removeAideHooks from "../shared/removeAideHooks/index.js";

/** Indent unit from the first indented line (tabs or spaces); two spaces when none. */
function detectFormatting(text: string): FormattingOptions {
	const eol = /\r\n/.test(text.split("\n", 1)[0] ?? "") ? "\r\n" : "\n";
	const indent = /^([ \t]+)\S/m.exec(text)?.[1];
	if (indent === undefined) return { insertSpaces: true, tabSize: 2, eol };
	if (indent.startsWith("\t")) return { insertSpaces: false, tabSize: 1, eol };
	return { insertSpaces: true, tabSize: indent.length, eol };
}

/**
 * Plans AIDE's hook entries in the per-machine `.claude/settings.local.json`.
 *
 * `text` is the file's content, or `null` when it does not exist; `entry` is
 * this machine's installed entry point (absolute, forward slashes), which
 * becomes the `node "<entry>" hook` command. A missing (or blank) file yields
 * a new file holding only the `hooks` object. Otherwise the file is parsed as
 * JSON-with-comments and every event without exactly one current AIDE hook is
 * outdated: its old, stale, duplicate or untimed AIDE hooks are removed and one
 * canonical group is appended, as `jsonc-parser` edits, so every byte outside
 * those ranges is the user's own. Planning the merged text again yields `complete`.
 */
export default function mergeLocal({ text, entry }: { text: string | null; entry: string }): LocalHooksPlan {
	const entries = aideHookEntries(buildCommand(entry));

	if (text === null || text.trim() === "") {
		const hooks = Object.fromEntries(entries.map(({ event, group }) => [event, [group]]));
		return { state: "absent", merged: `${JSON.stringify({ hooks }, null, 2)}\n` };
	}

	const parsed = parseSettings(text);
	if (!parsed.ok) return { state: "malformed", reason: parsed.reason };
	const { settings, hooks } = parsed;
	const wronglyShaped = entries.find(({ event }) => hooks[event] !== undefined && !Array.isArray(hooks[event]));
	if (wronglyShaped) return { state: "malformed", reason: `"hooks.${wronglyShaped.event}" is not an array` };

	const wired = findWiredEvents({ settings, entries });
	const outdated = entries.filter(({ event }) => !wired.has(event));
	if (outdated.length === 0) return { state: "complete" };

	// Strip every AIDE hook of the outdated events first, so the append never leaves a duplicate.
	let merged = removeAideHooks({ text, settings, events: new Set(outdated.map(({ event }) => event)) });
	const formattingOptions = detectFormatting(text);
	for (const { event, group } of outdated) {
		const [insertion] = modify(merged, ["hooks", event, -1], group, {});
		merged = applyEdits(merged, [insertion]);
		// Format only the inserted range, so the user's own bytes are never reflowed.
		const range = { offset: insertion.offset, length: insertion.content.length };
		merged = applyEdits(merged, format(merged, range, formattingOptions));
	}
	return { state: "outdated", events: outdated.map(({ event }) => event), merged };
}
