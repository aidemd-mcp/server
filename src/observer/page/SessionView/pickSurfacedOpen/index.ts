import type { WaitingFile } from "@/types/index.js";
import type { DrawerItem } from "@/observer/page/types/index.js";

/**
 * Decides whether the drawer opens the surfaced file. The key is `<file>#<sessionId>#<seq>` of the
 * surfaced waiting event; the drawer opens only when it differs from the last key held, so the
 * user's own clicks stand until a different file is surfaced. No surfaced file clears the key and
 * opens nothing, so the same file waiting again later (a new event) opens again. What opens is the
 * file itself: the drawer turns a plan, todo, spec or brief into its module's view.
 */
export default function pickSurfacedOpen({
	surfaced,
	lastKey,
}: {
	surfaced: WaitingFile | null;
	lastKey: string | null;
}): { key: string | null; open: DrawerItem | null } {
	if (surfaced === null) return { key: null, open: null };
	const key = `${surfaced.file}#${surfaced.sessionId}#${surfaced.seq}`;
	if (key === lastKey) return { key, open: null };
	return { key, open: { kind: "file", path: surfaced.file } };
}
