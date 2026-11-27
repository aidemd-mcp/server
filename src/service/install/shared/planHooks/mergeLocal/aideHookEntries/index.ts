import type { HookEventName, HookMatcherGroup } from "@/types/index.js";

/** Seconds Claude Code waits for the SessionEnd hook before killing it (brief #3). */
const SESSION_END_TIMEOUT_SECONDS = 10;

const group = ({ command, matcher, timeout }: { command: string; matcher?: string; timeout?: number }): HookMatcherGroup => ({
	...(matcher === undefined ? {} : { matcher }),
	hooks: [{ type: "command", command, ...(timeout === undefined ? {} : { timeout }) }],
});

/**
 * The five events AIDE wires in `.claude/settings.local.json`, in order, each
 * with the matcher group it adds for `command`. `PostToolUse` matches every
 * tool; the others carry no `matcher`, which means all. Only `SessionEnd`
 * carries a `timeout`.
 */
export default function aideHookEntries(command: string): readonly { event: HookEventName; group: HookMatcherGroup }[] {
	return [
		{ event: "SessionStart", group: group({ command }) },
		{ event: "UserPromptSubmit", group: group({ command }) },
		{ event: "PostToolUse", group: group({ command, matcher: "*" }) },
		{ event: "Stop", group: group({ command }) },
		{ event: "SessionEnd", group: group({ command, timeout: SESSION_END_TIMEOUT_SECONDS }) },
	];
}
