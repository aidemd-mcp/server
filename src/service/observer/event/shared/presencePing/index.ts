import { z } from "zod";
import { SESSION_ID_PATTERN } from "@/util/runtimePaths/shared/isSessionId/index.js";

/**
 * The body of a presence ping, `POST protocol.presenceRoute`: it names the
 * Claude session whose presence just changed and nothing else, so a ping
 * carries no state of its own (brief commitments #10, #99). Contract file:
 * named exports, no default export.
 */
export const schema = z
	.object({
		claudeSessionId: z.string().regex(SESSION_ID_PATTERN),
	})
	.strict();

export type PresencePing = z.infer<typeof schema>;
