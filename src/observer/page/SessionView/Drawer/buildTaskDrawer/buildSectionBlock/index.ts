import parseBlocks from "@/observer/page/shared/Markdown/parseBlocks/index.js";
import type { DrawerBlockModel } from "@/observer/page/types/index.js";

/**
 * One section of a note as a block: a section made only of bullets or numbers is a list, anything
 * else is paragraphs (a stray list among prose keeps its items as paragraphs of their own). Null
 * for a section with no text.
 */
export default function buildSectionBlock({ heading, content }: { heading: string; content: string }): DrawerBlockModel | null {
	const blocks = parseBlocks(content);
	if (blocks.length === 0) return null;
	const texts = blocks.flatMap((block) => ("items" in block ? block.items : [block.text]));
	if (blocks.some((block) => block.type === "p")) return { heading, icon: "doc", badge: null, type: "text", paras: texts };
	return { heading, icon: "list", badge: null, type: "list", items: texts };
}
