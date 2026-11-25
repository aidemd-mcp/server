import type { MarkdownBlock } from "@/observer/page/types/index.js";
import readTableAlign from "./readTableAlign/index.js";
import splitTableRow from "./splitTableRow/index.js";

const BULLET = /^\s*[-*+]\s+(.*)$/;
const NUMBERED = /^\s*\d+[.)]\s+(.*)$/;
const HEADING = /^(#{1,6})\s+(.*)$/;
const FENCE = /^\s*```/;

/**
 * Splits markdown into paragraphs, bulleted or numbered lists, headings, fenced code blocks and GFM
 * pipe tables. A blank line ends a block; an indented line under a list item continues that item;
 * consecutive prose lines join into one paragraph; a fenced block keeps its lines exactly. A table is
 * a header row followed by a delimiter row with the same number of cells; its body runs until a blank
 * line or a line with no pipe, each row padded or cut to the header's width. HTML stays plain text,
 * never interpreted.
 */
export default function parseBlocks(markdown: string): MarkdownBlock[] {
	const blocks: MarkdownBlock[] = [];
	let open: MarkdownBlock | null = null;
	let code: string[] | null = null;
	const close = () => {
		if (open !== null) blocks.push(open);
		open = null;
	};

	const lines = markdown.replace(/\r\n?/g, "\n").split("\n");
	for (let index = 0; index < lines.length; index += 1) {
		const line = lines[index] ?? "";
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
		const head = splitTableRow(line);
		const align = head === null ? null : readTableAlign(splitTableRow(lines[index + 1] ?? "") ?? []);
		if (head !== null && align !== null && align.length === head.length) {
			close();
			const rows: string[][] = [];
			index += 2;
			for (; index < lines.length; index += 1) {
				const row = (lines[index] ?? "").trim() === "" ? null : splitTableRow(lines[index] ?? "");
				if (row === null) break;
				rows.push(head.map((_, column) => row[column] ?? ""));
			}
			index -= 1;
			blocks.push({ type: "table", head, align, rows });
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
