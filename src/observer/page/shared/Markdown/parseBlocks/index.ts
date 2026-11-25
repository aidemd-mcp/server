import type { MarkdownBlock } from "@/observer/page/types/index.js";

const BULLET = /^\s*[-*+]\s+(.*)$/;
const NUMBERED = /^\s*\d+[.)]\s+(.*)$/;
const HEADING = /^(#{1,6})\s+(.*)$/;
const FENCE = /^\s*```/;

/**
 * Splits markdown into paragraphs, bulleted or numbered lists, headings and fenced code blocks. A
 * blank line ends a block; an indented line under a list item continues that item; consecutive prose
 * lines join into one paragraph; a fenced block keeps its lines exactly. Tables and HTML stay plain
 * paragraph text, never interpreted.
 */
export default function parseBlocks(markdown: string): MarkdownBlock[] {
	const blocks: MarkdownBlock[] = [];
	let open: MarkdownBlock | null = null;
	let code: string[] | null = null;
	const close = () => {
		if (open !== null) blocks.push(open);
		open = null;
	};

	for (const line of markdown.replace(/\r\n?/g, "\n").split("\n")) {
		if (code !== null) {
			if (FENCE.test(line)) {
				blocks.push({ type: "code", text: code.join("\n") });
				code = null;
			} else code.push(line);
			continue;
		}
		if (FENCE.test(line)) {
			close();
			code = [];
			continue;
		}
		if (line.trim() === "") {
			close();
			continue;
		}
		const heading = HEADING.exec(line);
		if (heading !== null) {
			close();
			blocks.push({ type: "h", level: heading[1]!.length, text: (heading[2] ?? "").trim() });
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
		} else if ((open.type === "ul" || open.type === "ol") && /^\s/.test(line) && open.items.length > 0) {
			open.items[open.items.length - 1] += ` ${line.trim()}`;
		} else {
			close();
			open = { type: "p", text: line.trim() };
		}
	}
	if (code !== null) blocks.push({ type: "code", text: code.join("\n") });
	close();
	return blocks;
}
