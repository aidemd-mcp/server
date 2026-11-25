import { unlink } from "node:fs/promises";
import resolveArchivedLog from "@/util/runtimePaths/resolveArchivedLog/index.js";
import type { DeleteOutcome } from "@/service/observer/event/types/index.js";

/**
 * Permanently deletes one archived session's event log and nothing else: no folder, no other
 * session, no `observer.json`, nothing under the project root. The session is addressed by project
 * key and session id and only an archived log is ever touched (a session still in the events folder
 * is not found here), so a session must be archived before it can be deleted. An unsafe key or id
 * and a missing archived session are returned as values; an unlink failure other than a vanished
 * file throws.
 */
export default async function deleteSession(input: { projectKey: string; sessionId: string }): Promise<DeleteOutcome> {
	// Turn key and id into the archived file's path; an unsafe key or id is rejected, never resolved.
	let path: string;
	try {
		path = resolveArchivedLog(input);
	} catch (error) {
		return { outcome: "invalid-id", detail: (error as Error).message };
	}

	// Remove exactly this one file; no file means nothing archived under that id.
	try {
		await unlink(path);
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") return { outcome: "not-found" };
		throw error;
	}

	return { outcome: "deleted" };
}
