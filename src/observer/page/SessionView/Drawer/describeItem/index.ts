import type { DrawerContext, DrawerItem, DrawerModel } from "@/observer/page/types/index.js";
import classifyFile from "@/observer/page/SessionView/Drawer/classifyFile/index.js";
import findModuleRow from "@/observer/page/SessionView/Drawer/findModuleRow/index.js";

/**
 * The header an item shows before (or without) its content: the kind word and title the drawer
 * would carry for it, from the item alone. A module or an AIDE file shows as its module, any other
 * file by its path, a task by its slug, an event by its link spelling.
 */
export default function describeItem({ item, context }: { item: DrawerItem; context: DrawerContext }): Pick<DrawerModel, "kind" | "title" | "titleMono"> {
	switch (item.kind) {
		case "module":
			return { kind: "Module", title: findModuleRow({ folder: item.folder, context })?.label ?? item.folder, titleMono: true };
		case "file": {
			const classified = classifyFile(item.path);
			if (classified === null) return { kind: "File", title: item.path, titleMono: true };
			return { kind: "Module", title: findModuleRow({ folder: classified.folder, context })?.label ?? classified.folder, titleMono: true };
		}
		case "task":
			return { kind: "Kanban task", title: item.slug, titleMono: false };
		case "event":
			return { kind: "Event", title: `${item.sessionId}:${item.seq}`, titleMono: true };
	}
}
