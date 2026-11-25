import pickPathModule from "../shared/pickPathModule/index.js";
import resolveAppDataRoot from "../shared/resolveAppDataRoot/index.js";
import isSessionId from "../shared/isSessionId/index.js";
import isProjectKey from "../isProjectKey/index.js";
import { PRESENCE_FOLDER, RECORD_EXTENSION } from "../shared/runtimeNames/index.js";

/**
 * Resolve a Claude session's hook presence file from a project key, for
 * callers (the hook, the observer) that hold a key but no project root. Pure:
 * never writes. Throws on a key that is not a safe project key or a Claude
 * session id that is not one safe file-name segment, so an outside value can
 * never point outside the app-data root.
 */
export default function resolvePresenceFile({
	projectKey,
	claudeSessionId,
}: {
	projectKey: string;
	claudeSessionId: string;
}): string {
	if (!isProjectKey(projectKey)) {
		throw new Error(`Invalid project key "${projectKey}"`);
	}
	if (!isSessionId(claudeSessionId)) {
		throw new Error(`Invalid session id "${claudeSessionId}"`);
	}

	return pickPathModule().join(
		resolveAppDataRoot(),
		projectKey,
		PRESENCE_FOLDER,
		`${claudeSessionId}${RECORD_EXTENSION}`,
	);
}
