import { z } from "zod";
import { PATH_MAX } from "@/service/observer/event/shared/schema/index.js";
import { SESSION_ID_PATTERN } from "@/util/runtimePaths/shared/isSessionId/index.js";

/**
 * The shape of one Claude session's hook presence file,
 * `<root>/<project-key>/presence/<claudeSessionId>.json`: the hook writes it
 * (replaced whole on every call, newest `at` wins), and `readPresence` and the
 * liveness reader parse it with this schema. `sessionId` is the observer
 * session the Claude session is linked to; it is absent until the link lands.
 * Contract file: named exports, no default export (brief commitment #95).
 */
export const schema = z
	.object({
		v: z.literal(1),
		claudeSessionId: z.string().regex(SESSION_ID_PATTERN),
		sessionId: z.string().regex(SESSION_ID_PATTERN).optional(),
		state: z.enum(["working", "waiting", "ended"]),
		at: z.string().datetime(),
		hookEvent: z.enum(["SessionStart", "UserPromptSubmit", "PostToolUse", "Stop", "SessionEnd"]),
		transcriptPath: z.string().min(1).max(PATH_MAX).optional(),
	})
	.strict();

export type Presence = z.infer<typeof schema>;
