import readLiveness from "@/service/observer/event/readLiveness/index.js";
import type { RawSessionLog, SessionLog, UnlinkedPresence } from "@/service/observer/event/types/index.js";

/**
 * Gives each raw session log its liveness with one `readLiveness` call, so the
 * listing, the archive listing and restore all judge by the same reader. An
 * unreadable log is judged with no events, like any session with none. Also
 * returns the project's unlinked presence. It never writes.
 */
export default async function attachLiveness({
	projectKey,
	logs,
}: {
	projectKey: string;
	logs: RawSessionLog[];
}): Promise<{ sessions: SessionLog[]; unlinked: UnlinkedPresence[] }> {
	const report = await readLiveness({
		projectKey,
		sessions: logs.map(({ sessionId, events }) => ({ sessionId, events })),
		now: Date.now(),
	});

	return {
		sessions: logs.map((log) => ({ ...log, liveness: report.sessions[log.sessionId]! })),
		unlinked: report.unlinked,
	};
}
