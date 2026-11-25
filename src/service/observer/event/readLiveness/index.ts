import readPresence from "@/service/observer/event/shared/readPresence/index.js";
import judgeEntry from "@/service/observer/event/readLiveness/judgeEntry/index.js";
import pickNewestPresence from "@/service/observer/event/readLiveness/pickNewestPresence/index.js";
import type { Presence } from "@/service/observer/event/shared/presenceRecord/index.js";
import type { ObserverEvent } from "@/service/observer/event/shared/schema/index.js";
import type { LivenessReport, SessionLiveness } from "@/service/observer/event/types/index.js";

/**
 * The one composed liveness reader (brief commitments #76, #96): every reader
 * of the project (listing, archive, restore, the start tool's HALT, the
 * observer) asks here, so the page and the refusals never disagree. Reads the
 * project's presence once, then judges each given session from its newest
 * linked presence, its ended mark and its transcript activity; every presence
 * that links to no observer session is judged on its own, with no events and
 * the ended mark kept under its Claude id. A presence linked to a session that
 * was not asked about is in neither result. Reads run in parallel and any read
 * failure degrades to "no presence / no mark" for that entry. It never writes.
 */
export default async function readLiveness({
	projectKey,
	sessions,
	now,
}: {
	projectKey: string;
	sessions: { sessionId: string; events: ObserverEvent[] }[];
	now: number;
}): Promise<LivenessReport> {
	// 1. One read of the project's presence; an unreadable folder counts as none.
	const presences: Presence[] = await readPresence({ projectKey }).catch(() => []);

	// 2. Judge every asked session and every unlinked presence in parallel.
	const [judged, unlinked] = await Promise.all([
		Promise.all(
			sessions.map(async ({ sessionId, events }): Promise<[string, SessionLiveness]> => {
				const presence = pickNewestPresence({ presences: presences.filter((p) => p.sessionId === sessionId) });
				return [sessionId, await judgeEntry({ projectKey, markId: sessionId, events, presence, now })];
			}),
		),
		Promise.all(
			presences
				.filter((presence) => presence.sessionId === undefined)
				.map(async (presence) => ({
					claudeSessionId: presence.claudeSessionId,
					liveness: await judgeEntry({
						projectKey,
						markId: presence.claudeSessionId,
						events: [],
						presence,
						now,
					}),
				})),
		),
	]);

	return { sessions: Object.fromEntries(judged), unlinked };
}
