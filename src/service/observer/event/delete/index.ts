import { unlink } from "node:fs/promises";
import resolveArchivedLog from "@/util/runtimePaths/resolveArchivedLog/index.js";
import resolveEndedMark from "@/util/runtimePaths/resolveEndedMark/index.js";
import resolvePresenceFile from "@/util/runtimePaths/resolvePresenceFile/index.js";
import readPresence from "@/service/observer/event/shared/readPresence/index.js";
import type { DeleteOutcome } from "@/service/observer/event/types/index.js";

/**
 * Permanently deletes one archived session's event log, its ended mark and every hook presence
 * linked to it, and nothing else: no folder, no other session (nor its presence), no unlinked
 * presence, no `observer.json`, nothing under the project root. The session is addressed by project
 * key and session id and only an archived log is ever touched (a session still in the events folder
 * is not found here), so a session must be archived before it can be deleted. An unsafe key or id
 * and a missing archived session are returned as values; an unlink failure other than a vanished
 * file throws. The mark and presence go only after the log is gone, so a failed delete never leaves
 * a log without its mark (it would read working again).
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

	// Then the session's ended mark and every presence linked to it; a file already gone is fine.
	const linked = (await readPresence({ projectKey: input.projectKey })).filter(
		(presence) => presence.sessionId === input.sessionId,
	);
	const files = [
		resolveEndedMark({ projectKey: input.projectKey, id: input.sessionId }),
		...linked.map(({ claudeSessionId }) => resolvePresenceFile({ projectKey: input.projectKey, claudeSessionId })),
	];
	await Promise.all(
		files.map((file) =>
			unlink(file).catch((error) => {
				if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
			}),
		),
	);

	return { outcome: "deleted" };
}
