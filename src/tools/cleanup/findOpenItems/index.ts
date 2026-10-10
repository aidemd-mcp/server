const LIST_CHECKBOX = /^\s*(?:[-*+]|\d+[.)])\s+\[( |x|X)\](.*)$/;

// Legacy plan format: `### N. [ ] title`, with an optional step number like `3.` or `3a.`.
const HEADING_CHECKBOX = /^\s*#{1,6}\s+(?:\d+[a-z]?\.\s+)?\[( |x|X)\](.*)$/;

/**
 * Scans one pipeline file's content for markdown checkboxes. Pure: no fs access.
 * Counts every checkbox (checked or not) and lists the unchecked ones with
 * their 1-based line number and text, so a refusal can name each open item.
 * Fenced code blocks are scanned like any other line: wrongly refusing is
 * recoverable (the refusal names the line), wrongly deleting is not.
 */
export default function findOpenItems(content: string): {
	total: number;
	open: { line: number; text: string }[];
} {
	const open: { line: number; text: string }[] = [];
	let total = 0;

	// Split on \r?\n so CRLF files (Windows) keep correct line numbers.
	content.split(/\r?\n/).forEach((raw, index) => {
		const match = LIST_CHECKBOX.exec(raw) ?? HEADING_CHECKBOX.exec(raw);
		if (!match) return;

		total++;
		if (match[1] !== " ") return;

		// An empty remainder falls back to the whole line so a refusal never shows a blank item.
		const text = match[2].trim() || raw.trim();
		open.push({ line: index + 1, text });
	});

	return { total, open };
}
