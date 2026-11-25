import { z } from "zod";
import { SESSION_ID_PATTERN } from "@/util/runtimePaths/shared/isSessionId/index.js";

const id = z.string().regex(SESSION_ID_PATTERN);

/**
 * The shape of one ended mark, `<root>/<project-key>/ended/<id>.json`, written
 * once and never changed: `<id>` is the observer session id, or, for a Claude
 * session that never linked to an observer session, its Claude session id.
 * Exactly one of `sessionId` / `claudeSessionId` is present. `bySessionId` is
 * the session that ended it when `endedBy` is `user`. Contract file: named
 * exports, no default export (brief commitments #72, #93, #95).
 */
export const schema = z
	.object({
		v: z.literal(1),
		sessionId: id.optional(),
		claudeSessionId: id.optional(),
		endedAt: z.string().datetime(),
		endedBy: z.enum(["hook", "user"]),
		bySessionId: id.optional(),
	})
	.strict()
	.refine((mark) => (mark.sessionId === undefined) !== (mark.claudeSessionId === undefined), {
		message: "exactly one of sessionId and claudeSessionId is required",
	});

export type EndedMark = z.infer<typeof schema>;
