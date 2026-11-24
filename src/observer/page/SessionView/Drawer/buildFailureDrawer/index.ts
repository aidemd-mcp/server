import type { DrawerContext, DrawerItem, DrawerModel } from "@/observer/page/types/index.js";
import describeItem from "@/observer/page/SessionView/Drawer/describeItem/index.js";

/**
 * The drawer for an item that could not be shown: its header and one block holding the observer's
 * message, nothing else (a failed read is told inside the drawer, never as an error page).
 */
export default function buildFailureDrawer({ item, message, context }: { item: DrawerItem; message: string; context: DrawerContext }): DrawerModel {
	return {
		...describeItem({ item, context }),
		meta: null,
		blocks: [{ heading: "Message", icon: "error", badge: null, type: "pre", text: message }],
	};
}
