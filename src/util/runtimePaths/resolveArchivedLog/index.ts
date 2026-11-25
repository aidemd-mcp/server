import pickPathModule from "../shared/pickPathModule/index.js";
import resolveAppDataRoot from "../shared/resolveAppDataRoot/index.js";
import isSessionId from "../shared/isSessionId/index.js";
import isProjectKey from "../isProjectKey/index.js";
import { ARCHIVE_FOLDER, LOG_EXTENSION } from "../shared/runtimeNames/index.js";

/**
 * Resolve an archived session's log path, `<root>/<projectKey>/archive/<id>.jsonl`, the folder
 * `archive` moves a past session's log into and `restore` moves it back from. Pure: never writes.
 * Throws on a key that is not a safe project key or an id that is not one safe file-name segment.
 */
export default function resolveArchivedLog({
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

	return pickPathModule().join(resolveAppDataRoot(), projectKey, ARCHIVE_FOLDER, `${sessionId}${LOG_EXTENSION}`);
}
