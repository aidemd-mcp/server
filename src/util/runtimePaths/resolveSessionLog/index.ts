import pickPathModule from "../shared/pickPathModule/index.js";
import resolveAppDataRoot from "../shared/resolveAppDataRoot/index.js";
import isSessionId from "../shared/isSessionId/index.js";
import isProjectKey from "../isProjectKey/index.js";
import { EVENTS_FOLDER, LOG_EXTENSION } from "../shared/runtimeNames/index.js";

/**
 * Resolve a session's event log path from a project key, for callers (the
 * observer) that hold a key but no project root. Pure: never writes. Throws on
 * a key that is not a safe project key or a session id that is not one safe
 * file-name segment, so an outside value can never point outside the app-data
 * root.
 */
export default function resolveSessionLog({
	projectKey,
	sessionId,
}: {
	projectKey: string;
	sessionId: string;
}): string {
	if (!isProjectKey(projectKey)) {
		throw new Error(`Invalid project key "${projectKey}"`);
	}
	if (!isSessionId(sessionId)) {
		throw new Error(`Invalid session id "${sessionId}"`);
	}

	return pickPathModule().join(resolveAppDataRoot(), projectKey, EVENTS_FOLDER, `${sessionId}${LOG_EXTENSION}`);
}
