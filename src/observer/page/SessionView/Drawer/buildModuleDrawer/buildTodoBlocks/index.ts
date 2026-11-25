import type { DrawerBlockModel } from "@/observer/page/types/index.js";
import listItems from "@/observer/page/SessionView/Drawer/listItems/index.js";
import parseTodoItems from "@/observer/page/SessionView/Drawer/parseTodoItems/index.js";

/**
 * A todo's blocks: its issues (location, what is wrong, fixed or open) with a badge of how many are
 * open, then its retro as a list. Each is left out when the file has none.
 */
export default function buildTodoBlocks({ text }: { text: string }): DrawerBlockModel[] {
	const { items, retro } = parseTodoItems(text);
	const blocks: DrawerBlockModel[] = [];
	if (items.length > 0) {
		const open = items.filter((item) => !item.done).length;
		blocks.push({
			heading: "Issues",
			icon: "issues",
			badge: { text: `${open} of ${items.length} open`, tone: open > 0 ? "danger" : "done" },
			type: "issues",
			items: items.map((item) => ({ loc: item.loc ?? "", text: item.text, done: item.done })),
		});
	}
	if (retro !== null) blocks.push({ heading: "Retro (the ## Retro section: lessons for the playbook)", icon: "history", badge: null, type: "list", items: listItems(retro) });
	return blocks;
}
