import type { MarkdownBlock } from "@/observer/page/types/index.js";

const BULLET = /^\s*[-*+]\s+(.*)$/;
const NUMBERED = /^\s*\d+[.)]\s+(.*)$/;

/**
 * Splits markdown into paragraphs and bulleted or numbered lists. A blank line ends a block; an
 * indented line under a list item continues that item; consecutive prose lines join into one
 * paragraph. Anything else (headings, tables, HTML) is plain paragraph text, never interpreted.
 */
export default function parseBlocks(markdown: string): MarkdownBlock[] {
	const blocks: MarkdownBlock[] = [];
	let open: MarkdownBlock | null = null;
	const close = () => {
		if (open !== null) blocks.push(open);
		open = null;
	};

	for (const line of markdown.replace(/\r\n?/g, "\n").split("\n")) {
		if (line.trim() === "") {
			close();
			continue;
		}
		const bullet = BULLET.exec(line);
		const numbered = bullet === null ? NUMBERED.exec(line) : null;
		const item = bullet ?? numbered;
		if (item !== null) {
			const type = bullet === null ? "ol" : "ul";
			if (open === null || open.type !== type) {
				close();
				open = { type, items: [] };
			}
			open.items.push((item[1] ?? "").trim());
			continue;
		}
		if (open === null) {
			open = { type: "p", text: line.trim() };
		} else if (open.type === "p") {
			open.text = `${open.text} ${line.trim()}`;
		} else if (/^\s/.test(line) && open.items.length > 0) {
			open.items[open.items.length - 1] += ` ${line.trim()}`;
		} else {
			close();
			open = { type: "p", text: line.trim() };
		}
	}
	close();
	return blocks;
}
