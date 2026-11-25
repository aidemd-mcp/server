import type { HookEventName } from "@/types/index.js";
import aidePackage from "../../aidePackage/index.js";

/** One matcher group of Claude Code's `hooks.<event>` array. */
export type HookMatcherGroup = {
	matcher?: string;
	hooks: { type: "command"; command: string }[];
};

/** AIDE's hook command, built from the package's bare command, never typed. */
export const AIDE_HOOK_COMMAND = `${aidePackage.command} hook`;

const group = (matcher?: string): HookMatcherGroup => ({
	...(matcher === undefined ? {} : { matcher }),
	hooks: [{ type: "command", command: AIDE_HOOK_COMMAND }],
});

/**
 * The five events AIDE wires in `.claude/settings.json`, in order, each with
 * the matcher group it adds (brief #88). `PostToolUse` matches every tool;
 * the others carry no `matcher`, which means all. No `timeout` key.
 */
export default [
	{ event: "SessionStart", group: group() },
	{ event: "UserPromptSubmit", group: group() },
	{ event: "PostToolUse", group: group("*") },
	{ event: "Stop", group: group() },
	{ event: "SessionEnd", group: group() },
] as const satisfies readonly { event: HookEventName; group: HookMatcherGroup }[];
