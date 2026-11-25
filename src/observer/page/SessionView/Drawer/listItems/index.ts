import parseBlocks from "@/observer/page/shared/Markdown/parseBlocks/index.js";

/** The texts of a markdown fragment as list items: every bullet or number as one, every paragraph as one, every table body row as one (its cells joined by " · "). Pure. */
export default function listItems(markdown: string): string[] {
	return parseBlocks(markdown).flatMap((block) => {
		if (block.type === "table") return block.rows.map((row) => row.join(" · "));
		return "items" in block ? block.items : [block.text];
	});
}
