import type { EditSite, GovernedField } from "../types/index.js";

/**
 * Writes one governed line into a file's content by string surgery on the
 * offsets `readGovernedValue` computed, so every other byte is kept: no YAML is
 * re-serialized, quoting, key order and line terminators stay as they were.
 * `replace` swaps the target line's text for `<key>: <value>` (a trailing comment
 * on that line goes with it, and for a legacy intent spec the old `status` line
 * becomes the `alignment` line, so the file never holds both names); `insert`
 * adds the line `<key>: <value>` plus the file's terminator at `at`.
 */
export default function rewriteFieldLine({
	content,
	edit,
	key,
	value,
}: {
	content: string;
	edit: Extract<EditSite, { kind: "replace" | "insert" }>;
	key: GovernedField;
	value: string;
}): string {
	const line = `${key}: ${value}`;
	if (edit.kind === "replace") {
		return content.slice(0, edit.start) + line + content.slice(edit.end);
	}
	return content.slice(0, edit.at) + line + edit.eol + content.slice(edit.at);
}
