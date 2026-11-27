import type { HookInput } from "../types/index.js";
import isSessionId from "@/util/runtimePaths/shared/isSessionId/index.js";

/** The longest `transcript_path` the hook accepts, in UTF-16 units (brief commitment #87). */
const TRANSCRIPT_PATH_MAX = 1024;

/** True when `value` is absent (`undefined`) or a string. */
function isOptionalString(value: unknown): boolean {
	return value === undefined || typeof value === "string";
}

/**
 * Parses one hook input from its stdin text, without zod (brief commitment #150).
 * Returns null on malformed JSON, a non-object, a missing or unsafe `session_id` (one
 * with a path separator, say), a missing event name, or an optional string field of
 * another type; never throws. On success returns the parsed object itself, extra keys
 * kept except an own `__proto__` key, which is dropped as the old zod schema did.
 */
export default function parseHookInput(text: string): HookInput | null {
	let raw: unknown;
	try {
		raw = JSON.parse(text);
	} catch {
		return null;
	}
	if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
		return null;
	}
	const input = raw as Record<string, unknown>;
	const { session_id, hook_event_name, transcript_path, cwd, reason, tool_name } = input;
	if (typeof session_id !== "string" || !isSessionId(session_id)) {
		return null;
	}
	if (typeof hook_event_name !== "string") {
		return null;
	}
	if (!isOptionalString(transcript_path) || (typeof transcript_path === "string" && transcript_path.length > TRANSCRIPT_PATH_MAX)) {
		return null;
	}
	if (!isOptionalString(cwd) || !isOptionalString(reason) || !isOptionalString(tool_name)) {
		return null;
	}
	// zod's passthrough dropped an own `__proto__` key (JSON.parse makes one); keep that.
	delete input["__proto__"];
	return input as HookInput;
}
