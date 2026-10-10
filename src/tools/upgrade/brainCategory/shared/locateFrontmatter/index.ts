/**
 * Returns the raw-text offsets of a brain.aide file's frontmatter, mirroring how
 * `parseBrainAideFromString` finds it (leading whitespace is skipped, the closing fence is the
 * first `\n---` after the opening fence):
 *
 * - `yamlStart`: start of the line after the opening `---` fence line.
 * - `yamlEnd`: start of the closing `---` fence line, so `raw.slice(yamlStart, yamlEnd)` ends
 *   with the last YAML line's line break.
 * - `bodyStart`: just after the closing fence line's line break, or `raw.length` when the
 *   fence is the last line.
 *
 * Callers establish with the parser first that the frontmatter is well formed; a file with no
 * fence is a broken precondition and throws instead of yielding made-up offsets.
 */
export default function locateFrontmatter(raw: string): { yamlStart: number; yamlEnd: number; bodyStart: number } {
	const openFence = raw.length - raw.trimStart().length;
	if (!raw.startsWith("---", openFence)) throw new Error("locateFrontmatter called on text without an opening fence");

	const closeBreak = raw.indexOf("\n---", openFence + 3);
	if (closeBreak === -1) throw new Error("locateFrontmatter called on text without a closing fence");

	const yamlStart = raw.indexOf("\n", openFence + 3) + 1;
	const yamlEnd = closeBreak + 1;
	const fenceLineBreak = raw.indexOf("\n", yamlEnd);
	const bodyStart = fenceLineBreak === -1 ? raw.length : fenceLineBreak + 1;
	return { yamlStart, yamlEnd, bodyStart };
}
