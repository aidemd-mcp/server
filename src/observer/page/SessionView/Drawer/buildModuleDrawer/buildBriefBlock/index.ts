import type { DrawerBlockModel } from "@/observer/page/types/index.js";

/** A brief opened from the page: its text as one block, since the observer reports no structure for it. */
export default function buildBriefBlock({ text }: { text: string }): DrawerBlockModel {
	return { heading: "Brief", icon: "doc", badge: null, type: "pre", text };
}
