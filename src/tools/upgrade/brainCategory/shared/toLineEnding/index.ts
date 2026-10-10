/**
 * Converts LF-only template text to the file's line ending: every `\n` becomes `eol`.
 * Identity for `"\n"`. The input must not already contain `\r\n`, which is true of every
 * template block, separator and new launcher line this module hands in.
 */
export default function toLineEnding({ text, eol }: { text: string; eol: "\r\n" | "\n" }): string {
	return eol === "\n" ? text : text.replace(/\n/g, eol);
}
