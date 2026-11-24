import type { DrawerItem } from "@/observer/page/types/index.js";

/**
 * Lets a page that loaded with a detail in its link keep that detail: while `holding`, the first
 * file the status surfaces is swallowed (noted by the caller's key, not opened) and holding ends;
 * with nothing to open yet it keeps holding. Once released, every open passes through.
 */
export default function applyHold({ open, holding }: { open: DrawerItem | null; holding: boolean }): { open: DrawerItem | null; holding: boolean } {
	if (open === null) return { open: null, holding };
	return { open: holding ? null : open, holding: false };
}
