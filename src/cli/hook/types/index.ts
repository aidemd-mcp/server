import type { z } from "zod";
import type { schema } from "../parseHookInput/index.js";
import type { HookEventName } from "@/service/observer/event/types/index.js";

/** One Claude Code hook input as read from stdin (brief commitment #87); extra fields are kept but never read. */
export type HookInput = z.infer<typeof schema>;

/** What a hook event means for presence: the state to record and whether it ends the observer session (brief commitments #78, #92). */
export type HookMapping = {
	hookEvent: HookEventName;
	state: "working" | "waiting" | "ended";
	endsObserverSession: boolean;
};
