import { z } from "zod";
import type { HookInput } from "../types/index.js";
import isSessionId from "@/util/runtimePaths/shared/isSessionId/index.js";

/** The hook input fields the hook reads (brief commitment #87); everything else passes through unread. */
export const schema = z
	.object({
		session_id: z.string().refine(isSessionId),
		hook_event_name: z.string(),
		transcript_path: z.string().max(1024).optional(),
		cwd: z.string().optional(),
		reason: z.string().optional(),
		tool_name: z.string().optional(),
		tool_input: z.unknown().optional(),
		tool_response: z.unknown().optional(),
	})
	.passthrough();

/**
 * Parses one hook input from its stdin text. Returns null on malformed JSON, a
 * missing or unsafe `session_id` (one with a path separator, say) or a missing
 * event name; never throws.
 */
export default function parseHookInput(text: string): HookInput | null {
	let raw: unknown;
	try {
		raw = JSON.parse(text);
	} catch {
		return null;
	}
	const result = schema.safeParse(raw);
	return result.success ? result.data : null;
}
