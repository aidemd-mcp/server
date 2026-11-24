import resolveSessionLog from "@/util/runtimePaths/resolveSessionLog/index.js";
import removeSessionLog from "@/service/observer/event/delete/removeSessionLog/index.js";
import type { DeleteOutcome } from "@/service/observer/event/types/index.js";

/**
 * Deletes one past session's event log and nothing else: no folder, no other
 * session, no `observer.json`, nothing under the project root. The session is
 * addressed by project key and session id. Refuses while the session is live,
 * judged by the same rule the page shows. An unsafe key or id, a missing
 * session, a live session and an unreadable session (refused, never deleted)
 * are returned as values.
 */
export default async function deleteSession(input: { projectKey: string; sessionId: string }): Promise<DeleteOutcome> {
	// Turn key and id into the file path; an unsafe key or id is rejected, never resolved.
	let path: string;
	try {
		path = resolveSessionLog(input);
	} catch (error) {
		return { outcome: "invalid-id", detail: (error as Error).message };
	}

	return removeSessionLog({ path, sessionId: input.sessionId });
}
