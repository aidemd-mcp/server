import type { HookEventName, HookMatcherGroup } from "@/types/index.js";
import isAideHookCommand from "../../shared/isAideHookCommand/index.js";

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null && !Array.isArray(value);

/** The `type: "command"` hooks across one event's matcher groups that are AIDE's, in any launch form. */
const aideHooksOf = (groups: unknown[]): Record<string, unknown>[] =>
	groups.flatMap((group) =>
		isRecord(group) && Array.isArray(group.hooks)
			? group.hooks.filter(
					(hook): hook is Record<string, unknown> =>
						isRecord(hook) &&
						hook.type === "command" &&
						typeof hook.command === "string" &&
						isAideHookCommand(hook.command),
				)
			: [],
	);

/**
 * The events whose `hooks.<event>` array holds exactly one AIDE hook, and that
 * hook is current: its command equals the entry's command and its `timeout`
 * equals the entry's (both absent, or both the same number). Matcher and
 * position do not matter. Any other shape counts as not wired, so an old
 * launch form, a stale path, a missing SessionEnd budget or a duplicate all
 * mark the event for rewriting.
 */
export default function findWiredEvents({
	settings,
	entries,
}: {
	settings: unknown;
	entries: readonly { event: HookEventName; group: HookMatcherGroup }[];
}): Set<HookEventName> {
	const wired = new Set<HookEventName>();
	if (!isRecord(settings) || !isRecord(settings.hooks)) return wired;
	for (const { event, group } of entries) {
		const groups = settings.hooks[event];
		if (!Array.isArray(groups)) continue;
		const aideHooks = aideHooksOf(groups);
		if (aideHooks.length !== 1) continue;
		const [current] = group.hooks;
		const [found] = aideHooks;
		if (found.command === current.command && found.timeout === current.timeout) wired.add(event);
	}
	return wired;
}
