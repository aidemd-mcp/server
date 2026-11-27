import readPresence from "@/service/observer/event/shared/readPresence/index.js";
import groupConversations from "@/service/observer/event/shared/groupConversations/index.js";
import judgeConversation from "@/service/observer/event/shared/judgeConversation/index.js";
import type { Presence } from "@/service/observer/event/shared/presenceRecord/index.js";
import type { ObserverEvent } from "@/service/observer/event/shared/schema/index.js";
import type { LivenessReport, SessionLiveness } from "@/service/observer/event/types/index.js";

/**
 * The one composed liveness reader (brief commitments #76, #96, #133): every
 * reader of the project (listing, archive, restore, the start tool's HALT, the
 * observer) asks here, so the page and the refusals never disagree. Reads the
 * project's presence once and groups it into conversations (a resumed
 * conversation is one conversation across its observer sessions, #132), then
 * judges each given session through the conversation that holds its id (a
 * session no presence links to is a conversation of one), so every session of
 * a conversation reads the same liveness. Every conversation with no observer
 * session at all is judged on its own, with no events and the ended mark kept
 * under its Claude id. A conversation linked only to sessions that were not
 * asked about is in neither result. Reads run in parallel and any read failure
 * degrades to "no presence / no mark" for that entry. It never writes.
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
	const conversations = groupConversations({ presences });

	// 2. Judge every asked session and every unlinked conversation in parallel.
	const [judged, unlinked] = await Promise.all([
		Promise.all(
			sessions.map(async ({ sessionId, events }): Promise<[string, SessionLiveness]> => {
				const conversation = conversations.find(({ sessionIds }) => sessionIds.includes(sessionId)) ?? {
					sessionIds: [sessionId],
					claudeSessionIds: [],
					presences: [],
				};
				return [sessionId, await judgeConversation({ projectKey, conversation, events, now })];
			}),
		),
		Promise.all(
			conversations
				.filter(({ sessionIds }) => sessionIds.length === 0)
				.map(async (conversation) => ({
					claudeSessionId: conversation.claudeSessionIds[0],
					liveness: await judgeConversation({ projectKey, conversation, events: [], now }),
				})),
		),
	]);

	return { sessions: Object.fromEntries(judged), unlinked };
}
