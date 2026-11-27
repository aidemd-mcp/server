import type { ProjectHooksPlan } from "@/types/index.js";
import parseSettings from "../shared/parseSettings/index.js";
import removeAideHooks from "../shared/removeAideHooks/index.js";

/**
 * Plans the removal of AIDE's hook entries from the shared, committed
 * `.claude/settings.json`, where earlier releases wrote them.
 *
 * `text` is the file's content, or `null` when it does not exist. A file that
 * cannot be parsed is `malformed`; one with no AIDE hook anywhere under `hooks`
 * is `clean`. Otherwise `events` lists the `hooks` keys AIDE's entries were
 * found under and `stripped` is the whole file with them removed, every other
 * byte the user's own, so planning `stripped` again yields `clean`.
 */
export default function stripProject({ text }: { text: string | null }): ProjectHooksPlan {
	if (text === null || text.trim() === "") return { state: "absent" };

	const parsed = parseSettings(text);
	if (!parsed.ok) return { state: "malformed", reason: parsed.reason };
	const { settings, hooks } = parsed;

	const stripped = removeAideHooks({ text, settings });
	if (stripped === text) return { state: "clean" };

	// A key holds AIDE's hooks exactly when removing from that key alone changes the file.
	const events = Object.keys(hooks).filter(
		(event) => removeAideHooks({ text, settings, events: new Set([event]) }) !== text,
	);
	return { state: "holds", events, stripped };
}
