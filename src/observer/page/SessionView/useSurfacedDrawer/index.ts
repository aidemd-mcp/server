import { useEffect, useRef } from "react";
import type { WaitingFile } from "@/types/index.js";
import type { DrawerItem } from "@/observer/page/types/index.js";
import pickSurfacedOpen from "@/observer/page/SessionView/pickSurfacedOpen/index.js";
import applyHold from "./applyHold/index.js";

/**
 * Opens the surfaced waiting file in the drawer when it changes. The last surfaced key lives in a
 * ref, so the user's own clicks (which open items directly) never touch it and the user's choice
 * stands until a different file is surfaced. `holdFirst` is for a page that loaded with a detail
 * already in its link: the first surfaced file is noted but not opened, so the link's detail is not
 * replaced the moment the status arrives; every later change opens as usual.
 */
export default function useSurfacedDrawer({
	surfaced,
	holdFirst,
	onOpen,
}: {
	surfaced: WaitingFile | null;
	holdFirst: boolean;
	onOpen: (item: DrawerItem) => void;
}): void {
	const lastKey = useRef<string | null>(null);
	const holding = useRef(holdFirst);
	useEffect(() => {
		const picked = pickSurfacedOpen({ surfaced, lastKey: lastKey.current });
		lastKey.current = picked.key;
		const settled = applyHold({ open: picked.open, holding: holding.current });
		holding.current = settled.holding;
		if (settled.open !== null) onOpen(settled.open);
	}, [surfaced, onOpen]);
}
