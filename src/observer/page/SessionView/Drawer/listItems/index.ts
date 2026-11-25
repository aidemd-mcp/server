import parseBlocks from "@/observer/page/shared/Markdown/parseBlocks/index.js";

/** The texts of a markdown fragment as list items: every bullet or number as one, every paragraph as one. Pure. */
export default function listItems(markdown: string): string[] {
	return parseBlocks(markdown).flatMap((block) => ("items" in block ? block.items : [block.text]));
}
