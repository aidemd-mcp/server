/** Renders one new args line: the first item's indentation, `- `, and a single-quoted scalar (bare `-` for null). */
export default function renderArgLine({ indent, value, eol }: { indent: string; value: string | null; eol: "\r\n" | "\n" }): string | null {
	if (value === null) return `${indent}-${eol}`;
	if (/[\r\n]/.test(value)) return null;
	return `${indent}- '${value.replaceAll("'", "''")}'${eol}`;
}
