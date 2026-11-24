/**
 * The first non-blank line of a text, trimmed; `""` for a text of only blank lines. With `ellipsis`
 * a `…` follows it when more non-blank content comes after (trailing blank lines add none). Pure
 * string work with no Node imports, so the observer's browser page imports it as readily as the
 * server does.
 */
export default function firstLine({ text, ellipsis = false }: { text: string; ellipsis?: boolean }): string {
	const lines = text.split(/\r?\n/);
	const index = lines.findIndex((line) => line.trim() !== "");
	if (index === -1) return "";
	const first = (lines[index] as string).trim();
	if (!ellipsis) return first;
	const hasMore = lines.slice(index + 1).some((line) => line.trim() !== "");
	return hasMore ? `${first}…` : first;
}
