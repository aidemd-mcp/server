import { mkdir, rename } from "node:fs/promises";
import { dirname } from "node:path";
import resolveArchivedLog from "@/util/runtimePaths/resolveArchivedLog/index.js";
import resolveSessionLog from "@/util/runtimePaths/resolveSessionLog/index.js";
import readLiveness from "@/service/observer/event/readLiveness/index.js";
import readSessionLog from "@/service/observer/event/shared/readSessionLog/index.js";
import type { ArchiveOutcome } from "@/service/observer/event/types/index.js";

/**
 * Archives one past session: moves its event log from the project's `events` folder into the
 * project's `archive` folder, creating it when needed. Nothing else is touched. Refuses while the
 * session is live, judged by the rule the page shows, and refuses a log that cannot be read (its
 * liveness cannot be judged, and moving on that guess could hide a live session). "Live" means
 * not ended: a session with no ended mark and no SessionEnd presence is refused, however quiet. An unsafe key or
 * id, a missing session, a live one and an unreadable one are returned as values; a failed move
 * other than a vanished file throws.
 */
export default async function archiveSession(input: { projectKey: string; sessionId: string }): Promise<ArchiveOutcome> {
	// 1. Turn key and id into both paths; an unsafe key or id is rejected, never resolved.
	let from: string;
	let to: string;
	try {
		from = resolveSessionLog(input);
		to = resolveArchivedLog(input);
	} catch (error) {
		return { outcome: "invalid-id", detail: (error as Error).message };
	}

	// 2. Read the session the way `read` sees it; no file means nothing to archive.
	const log = await readSessionLog({ path: from, sessionId: input.sessionId });
	if (!log) return { outcome: "not-found" };
	if (log.unreadable) return { outcome: "unreadable" };

	// 3. Only an ended session may move; the one liveness reader decides, as it does for the page.
	const report = await readLiveness({
		projectKey: input.projectKey,
		sessions: [{ sessionId: input.sessionId, events: log.events }],
		now: Date.now(),
	});
	if (report.sessions[input.sessionId]?.state !== "ended") return { outcome: "live" };

	// 4. Move exactly this one file; a file that vanished since the read is not-found.
	await mkdir(dirname(to), { recursive: true });
	try {
		await rename(from, to);
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") return { outcome: "not-found" };
		throw error;
	}

	return { outcome: "archived" };
}
