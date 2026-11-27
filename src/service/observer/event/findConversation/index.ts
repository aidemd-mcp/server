import readPresence from "@/service/observer/event/shared/readPresence/index.js";
import groupConversations from "@/service/observer/event/shared/groupConversations/index.js";
import readConversationMark from "@/service/observer/event/shared/readConversationMark/index.js";
import readSessionStart from "@/service/observer/event/shared/readSessionStart/index.js";
import listSessionIds from "@/service/observer/event/shared/listSessionIds/index.js";
import type { CallerConversation, ConversationRef } from "@/service/observer/event/types/index.js";

/**
 * Looks up the start check's caller (brief commitments #129, #134), never
 * writing. Finds the conversation that holds `sessionId` (a caller whose own
 * link has not landed is a conversation of one), the mark that decides its
 * end, its start for the newer test (the greatest earlier session's start,
 * else the caller's own; null when the id carries no time) and whether another
 * session of the project started after that: a session with a log outside the
 * conversation, or a presence with no link at all (its last activity stands in
 * for a start it does not have, erring toward a hard stop). Only a conversation
 * with a mark is tested for newer, so the logs are not listed for any other.
 */
export default async function findConversation({
	projectKey,
	sessionId,
}: {
	projectKey: string;
	sessionId: string;
}): Promise<CallerConversation> {
	// 1. The conversation holding the caller, else a conversation of one.
	const presences = await readPresence({ projectKey }).catch(() => []);
	const conversations = groupConversations({ presences });
	const held = conversations.find((conversation) => conversation.sessionIds.includes(sessionId));
	const ref: ConversationRef = held
		? { sessionIds: held.sessionIds, claudeSessionIds: held.claudeSessionIds }
		: { sessionIds: [sessionId], claudeSessionIds: [] };

	// 2. The mark that decides whether it ended.
	const mark = await readConversationMark({ projectKey, conversation: ref });

	// 3. Its start: the greatest earlier session's, else the caller's own.
	const earlier = ref.sessionIds.filter((id) => id !== sessionId);
	const startedAt = readSessionStart({ sessionId: earlier[earlier.length - 1] ?? sessionId });
	const caller = { ...ref, mark, startedAt };
	if (mark === null || startedAt === null) return { ...caller, newer: false };

	// 4. Newer: a session outside the set that started later, or an unlinked presence that was active later.
	const logs = await listSessionIds({ projectKey });
	const laterLog = logs.some((id) => {
		if (ref.sessionIds.includes(id)) return false;
		const start = readSessionStart({ sessionId: id });
		return start !== null && start > startedAt;
	});
	const laterUnlinked = conversations
		.filter((conversation) => conversation.sessionIds.length === 0)
		.filter((conversation) => !conversation.claudeSessionIds.some((id) => ref.claudeSessionIds.includes(id)))
		.some((conversation) => conversation.presences.some((presence) => Date.parse(presence.at) > startedAt));

	return { ...caller, newer: laterLog || laterUnlinked };
}
