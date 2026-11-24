import { readdir } from "node:fs/promises";
import resolveSessionLog from "@/util/runtimePaths/resolveSessionLog/index.js";
import { LOG_EXTENSION } from "@/util/runtimePaths/shared/runtimeNames/index.js";
import findNewestStart from "@/service/observer/event/shared/findNewestStart/index.js";
import readSessionLog from "@/service/observer/event/shared/readSessionLog/index.js";
import type { ProjectLog, SessionLog } from "@/service/observer/event/types/index.js";

/**
 * Reads one project folder's recorded sessions, oldest first, and the root its
 * newest session reported. Resolves null when the folder has no events folder
 * or session left in it, so the project listing never
 * shows an empty project. `projectRoot` is exactly what the newest
 * `session_started` carried, never inferred (brief commitment #38). It never
 * writes.
 */
export default async function readProject({
	projectKey,
	eventsFolder,
}: {
	projectKey: string;
	eventsFolder: string;
}): Promise<ProjectLog | null> {
	// 1. List the events folder; no folder means this project holds no session.
	let entries;
	try {
		entries = await readdir(eventsFolder, { withFileTypes: true });
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
		throw error;
	}

	// 2. Keep regular session-log files; the stem is the session id.
	const stems = entries
		.filter((entry) => entry.isFile() && entry.name.endsWith(LOG_EXTENSION))
		.map((entry) => entry.name.slice(0, -LOG_EXTENSION.length));

	// 3. Resolve each stem's path; a stem that is not a safe session id is not a session file.
	const files: { sessionId: string; path: string }[] = [];
	for (const sessionId of stems) {
		try {
			files.push({ sessionId, path: resolveSessionLog({ projectKey, sessionId }) });
		} catch {
			continue;
		}
	}

	// 4. Session ids start with a sortable UTC timestamp, so ascending is chronological.
	files.sort((a, b) => (a.sessionId < b.sessionId ? -1 : a.sessionId > b.sessionId ? 1 : 0));

	// 5. Read every session in parallel (order preserved) and drop any that vanished.
	const logs = await Promise.all(files.map(({ sessionId, path }) => readSessionLog({ path, sessionId })));
	const sessions = logs.filter((log): log is SessionLog => log !== null);
	if (sessions.length === 0) return null;

	// 6. The root is what the newest session reported, or null when none did.
	return { projectKey, projectRoot: findNewestStart({ sessions })?.projectRoot ?? null, sessions };
}
