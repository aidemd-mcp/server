import pickPathModule from "../shared/pickPathModule/index.js";
import resolveAppDataRoot from "../shared/resolveAppDataRoot/index.js";
import isSessionId from "../shared/isSessionId/index.js";
import isProjectKey from "../isProjectKey/index.js";
import { ENDED_FOLDER, RECORD_EXTENSION } from "../shared/runtimeNames/index.js";

/**
 * Resolve an observer session's ended-mark path from a project key, for
 * callers (the hook, the end-session tool, the observer) that hold a key but
 * no project root. Pure: never writes. Throws on a key that is not a safe
 * project key or a session id that is not one safe file-name segment, so an
 * outside value can never point outside the app-data root.
 */
export default function resolveEndedMark({ projectKey, id }: { projectKey: string; id: string }): string {
	if (!isProjectKey(projectKey)) {
		throw new Error(`Invalid project key "${projectKey}"`);
	}
	if (!isSessionId(id)) {
		throw new Error(`Invalid session id "${id}"`);
	}

	return pickPathModule().join(resolveAppDataRoot(), projectKey, ENDED_FOLDER, `${id}${RECORD_EXTENSION}`);
}
