import { readdir } from "node:fs/promises";
import { dirname } from "node:path";
import isProjectKey from "@/util/runtimePaths/isProjectKey/index.js";
import resolveArchivedLog from "@/util/runtimePaths/resolveArchivedLog/index.js";
import { LOG_EXTENSION } from "@/util/runtimePaths/shared/runtimeNames/index.js";
import attachLiveness from "@/service/observer/event/shared/attachLiveness/index.js";
import readSessionLog from "@/service/observer/event/shared/readSessionLog/index.js";
import type { RawSessionLog, SessionLog } from "@/service/observer/event/types/index.js";

/**
 * Lists one project's archived sessions, oldest first. A key that is not a project key, a project
 * with no archive folder and an empty archive all answer `[]`; a file whose stem is not a safe
 * session id is skipped. Each session carries its liveness (one `readLiveness` call). Never writes and never creates the archive folder.
 */
export default async function readArchive({ projectKey }: { projectKey: string }): Promise<SessionLog[]> {
	if (!isProjectKey(projectKey)) return [];

	// 1. The archive folder is the directory of any archived path; list it.
	const folder = dirname(resolveArchivedLog({ projectKey, sessionId: "probe" }));
	let entries;
	try {
		entries = await readdir(folder, { withFileTypes: true });
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
		throw error;
	}

	// 2. Keep regular session-log files whose stem is a safe session id, oldest first.
	const files: { sessionId: string; path: string }[] = [];
	for (const entry of entries) {
		if (!entry.isFile() || !entry.name.endsWith(LOG_EXTENSION)) continue;
		const sessionId = entry.name.slice(0, -LOG_EXTENSION.length);
		try {
			files.push({ sessionId, path: resolveArchivedLog({ projectKey, sessionId }) });
		} catch {
			continue;
		}
	}
	files.sort((a, b) => (a.sessionId < b.sessionId ? -1 : a.sessionId > b.sessionId ? 1 : 0));

	// 3. Read every one in parallel (order preserved) and drop any that vanished.
	const logs = await Promise.all(files.map(readSessionLog));
	const raw = logs.filter((log): log is RawSessionLog => log !== null);

	// 4. Judge them all in one liveness read.
	return (await attachLiveness({ projectKey, logs: raw })).sessions;
}
