import pickPathModule from "../shared/pickPathModule/index.js";
import resolve from "../resolve/index.js";
import isSessionId from "../shared/isSessionId/index.js";
import { LOG_EXTENSION } from "../shared/runtimeNames/index.js";

/**
 * Resolve the event log path for one session of a project. Pure: never writes.
 * Throws when `sessionId` is not one safe file-name segment (no separators,
 * no `..`, no leading dot), so a caller-supplied id can never point outside
 * the events folder.
 */
export default function resolveEventLog({
	projectRoot,
	sessionId,
}: {
	projectRoot: string;
	sessionId: string;
}): string {
	// Reject any id that is not a single safe file-name segment.
	if (!isSessionId(sessionId)) {
		throw new Error(`Invalid session id "${sessionId}"`);
	}

	// Resolve the project's runtime paths.
	const { eventsFolder } = resolve({ projectRoot });

	// Place the session's log inside the events folder.
	return pickPathModule().join(eventsFolder, `${sessionId}${LOG_EXTENSION}`);
}
