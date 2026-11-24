import type { DrawerItem } from "@/observer/page/types/index.js";

/** Writes a detail as the `?item=` value `parseItem` reads back, before URL encoding. */
export default function formatItem(item: DrawerItem): string {
	switch (item.kind) {
		case "module":
			return `module:${item.folder}`;
		case "task":
			return `task:${item.slug}`;
		case "file":
			return `file:${item.path}`;
		case "event":
			return `event:${item.sessionId}:${item.seq}`;
	}
}
