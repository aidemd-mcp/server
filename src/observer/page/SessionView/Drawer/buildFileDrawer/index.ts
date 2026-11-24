import baseName from "@/util/baseName/index.js";
import type { DrawerModel } from "@/observer/page/types/index.js";

/** The drawer for any file the page does not draw as a module: kind `File`, the path as a mono title, the text as one block headed by the file's name. */
export default function buildFileDrawer({ path, text }: { path: string; text: string }): DrawerModel {
	return {
		kind: "File",
		title: path,
		titleMono: true,
		meta: null,
		blocks: [{ heading: baseName(path), icon: "file", badge: null, type: "pre", text }],
	};
}
