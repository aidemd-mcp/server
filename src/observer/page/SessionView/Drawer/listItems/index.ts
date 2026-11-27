import blockTexts from "@/observer/page/shared/Markdown/blockTexts/index.js";
import parseBlocks from "@/observer/page/shared/Markdown/parseBlocks/index.js";

/** The texts of a markdown fragment as list items: every bullet or number as one (nested ones after their parent), every paragraph as one, every table body row as one (its cells joined by " · "). Pure. */
export default function listItems(markdown: string): string[] {
	return parseBlocks(markdown).flatMap(blockTexts);
}
