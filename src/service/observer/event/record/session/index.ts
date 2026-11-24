import type { ProcessSession } from "@/service/observer/event/types/index.js";
import createSession from "@/service/observer/event/record/session/createSession/index.js";

// Module-level on purpose: the session IS the process. One MCP server process
// records one session, so the state must outlive every individual tool call.
let session: ProcessSession | undefined;

/**
 * Returns the per-process session, creating it on the first call and returning
 * the same object on every later call (brief commitment #8). `record` stamps
 * every event with it and appends through its queue so lines land whole and in
 * `seq` order.
 */
export default function getSession(): ProcessSession {
	session ??= createSession();
	return session;
}
