import type { MarkdownBlock } from "@/observer/page/types/index.js";

/** A block's texts in reading order: a list gives each item's text followed by the texts nested under it, a table its body rows (cells joined by " · "), any other block its text. Pure. */
export default function blockTexts(block: MarkdownBlock): string[] {
	if (block.type === "table") return block.rows.map((row) => row.join(" · "));
	if ("items" in block) {
		return block.items.flatMap((item) => [...(item.text === "" ? [] : [item.text]), ...item.blocks.flatMap(blockTexts)]);
	}
	return [block.text];
}
