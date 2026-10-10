/**
 * Returns the line ending a file uses: `"\r\n"` when its first `\n` is preceded by `\r`,
 * otherwise `"\n"` (also when the text has no line break at all). Splices use it so
 * inserted bytes never mix line-ending styles into a file that had one.
 */
export default function detectLineEnding(raw: string): "\r\n" | "\n" {
	const firstBreak = raw.indexOf("\n");
	return firstBreak > 0 && raw[firstBreak - 1] === "\r" ? "\r\n" : "\n";
}
