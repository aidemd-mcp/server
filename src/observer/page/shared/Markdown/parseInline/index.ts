import type { InlineNode } from "@/observer/page/types/index.js";

const INLINE = /\*\*([^*\n]+)\*\*|`([^`\n]+)`/g;

/** Splits one line of text into plain, `**bold**` and `` `code` `` runs; an unclosed marker stays plain text. */
export default function parseInline(text: string): InlineNode[] {
	const nodes: InlineNode[] = [];
	let cursor = 0;
	for (const match of text.matchAll(INLINE)) {
		if (match.index > cursor) nodes.push({ type: "text", text: text.slice(cursor, match.index) });
		nodes.push(match[1] === undefined ? { type: "code", text: match[2] ?? "" } : { type: "bold", text: match[1] });
		cursor = match.index + match[0].length;
	}
	if (cursor < text.length) nodes.push({ type: "text", text: text.slice(cursor) });
	return nodes;
}
