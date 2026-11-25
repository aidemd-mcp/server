import type { HookInput, HookMapping } from "../types/index.js";

/**
 * Maps a hook input to the presence it records (brief commitments #78, #92):
 * SessionStart, UserPromptSubmit and PostToolUse are `working`; Stop is
 * `waiting`; SessionEnd is `ended` and ends the observer session unless its
 * reason is `clear` or `resume` (the same Claude session keeps going). Any other
 * event name returns null.
 */
export default function mapHookEvent(input: HookInput): HookMapping | null {
	switch (input.hook_event_name) {
		case "SessionStart":
		case "UserPromptSubmit":
		case "PostToolUse":
			return { hookEvent: input.hook_event_name, state: "working", endsObserverSession: false };
		case "Stop":
			return { hookEvent: "Stop", state: "waiting", endsObserverSession: false };
		case "SessionEnd":
			return {
				hookEvent: "SessionEnd",
				state: "ended",
				endsObserverSession: input.reason !== "clear" && input.reason !== "resume",
			};
		default:
			return null;
	}
}
