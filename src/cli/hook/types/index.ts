import type { HookEventName } from "@/service/observer/event/types/index.js";

/**
 * One Claude Code hook input as read from stdin (brief commitments #87, #150): the
 * hook-input contract, which `parseHookInput` checks. Only the fields the hook reads
 * are named; extra fields are kept but never read.
 */
export type HookInput = {
	session_id: string;
	hook_event_name: string;
	transcript_path?: string;
	cwd?: string;
	reason?: string;
	tool_name?: string;
	tool_input?: unknown;
	tool_response?: unknown;
} & { [key: string]: unknown };

/** What a hook event means for presence: the state to record and whether it ends the observer session (brief commitments #78, #92). */
export type HookMapping = {
	hookEvent: HookEventName;
	state: "working" | "waiting" | "ended";
	endsObserverSession: boolean;
};
