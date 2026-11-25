import type { HookEventName } from "@/types/index.js";
import aideHookEntries, { AIDE_HOOK_COMMAND } from "../aideHookEntries/index.js";

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null && !Array.isArray(value);

const holdsAideCommand = (group: unknown): boolean =>
	isRecord(group) &&
	Array.isArray(group.hooks) &&
	group.hooks.some(
		(hook) =>
			isRecord(hook) &&
			hook.type === "command" &&
			typeof hook.command === "string" &&
			hook.command.trim() === AIDE_HOOK_COMMAND,
	);

/**
 * The events whose `hooks.<event>` array already holds a matcher group with a
 * `type: "command"` hook whose trimmed command is AIDE's. Position and matcher
 * do not matter. Any other shape (non-objects, non-arrays, missing keys) counts
 * as not wired.
 */
export default function findWiredEvents(settings: unknown): Set<HookEventName> {
	const wired = new Set<HookEventName>();
	if (!isRecord(settings) || !isRecord(settings.hooks)) return wired;
	for (const { event } of aideHookEntries) {
		const groups = settings.hooks[event];
		if (Array.isArray(groups) && groups.some(holdsAideCommand)) wired.add(event);
	}
	return wired;
}
