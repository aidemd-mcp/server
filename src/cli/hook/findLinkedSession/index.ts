import type { HookInput } from "../types/index.js";
import parseSessionTag from "@/service/observer/event/shared/parseSessionTag/index.js";

const OBSERVER_TOOL_SUFFIX = "__aide_observer_event";

/**
 * Finds the observer session a PostToolUse reply names: only for a tool whose
 * name ends with `__aide_observer_event` (whatever the server or plugin
 * prefix), it reads the `[observer-session <id>]` tag out of the reply (brief
 * commitment #90). Null for any other event, tool or reply without the tag.
 */
export default function findLinkedSession(input: HookInput): string | null {
	if (input.hook_event_name !== "PostToolUse") return null;
	if (input.tool_name === undefined || !input.tool_name.endsWith(OBSERVER_TOOL_SUFFIX)) return null;
	const text = JSON.stringify(input.tool_response);
	if (text === undefined) return null;
	return parseSessionTag(text);
}
