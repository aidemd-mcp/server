import { mkdir } from "node:fs/promises";
import path from "node:path";
import resolveEndedMark from "@/util/runtimePaths/resolveEndedMark/index.js";
import readPresence from "@/service/observer/event/shared/readPresence/index.js";
import groupConversations from "@/service/observer/event/shared/groupConversations/index.js";
import readConversationMark from "@/service/observer/event/shared/readConversationMark/index.js";
import writeEndedMark from "@/service/observer/event/shared/writeEndedMark/index.js";
import type { ConversationRef, MarkClosedOutcome } from "@/service/observer/event/types/index.js";

/**
 * Marks a conversation closed from its transcript (brief commitment #122):
 * writes one ended mark with `endedBy: "transcript"` and `bySessionId` for the
 * conversation that holds `id`, an observer session id or the Claude id of a
 * presence. The mark is keyed by the conversation's greatest observer id, or
 * by its Claude id when it has no observer id. A conversation with any mark
 * already, of any kind, answers `exists` and nothing is written. It does not
 * judge liveness (the caller already did) and throws on a filesystem failure.
 */
export default async function markClosed({
	projectKey,
	id,
	bySessionId,
}: {
	projectKey: string;
	id: string;
	bySessionId: string;
}): Promise<MarkClosedOutcome> {
	// The conversation holding `id`, else a conversation of one.
	const presences = await readPresence({ projectKey }).catch(() => []);
	const held = groupConversations({ presences }).find(
		(conversation) => conversation.sessionIds.includes(id) || conversation.claudeSessionIds.includes(id),
	);
	const conversation: ConversationRef = held
		? { sessionIds: held.sessionIds, claudeSessionIds: held.claudeSessionIds }
		: { sessionIds: [id], claudeSessionIds: [] };

	if ((await readConversationMark({ projectKey, conversation })) !== null) return { outcome: "exists" };

	// Keyed by the greatest observer id, or by the Claude id of a conversation that never linked.
	const sessionId = conversation.sessionIds[conversation.sessionIds.length - 1];
	const claudeSessionId = conversation.claudeSessionIds.includes(id)
		? id
		: conversation.claudeSessionIds[conversation.claudeSessionIds.length - 1];
	const subject = sessionId !== undefined ? { sessionId } : { claudeSessionId: claudeSessionId as string };
	const key = sessionId ?? (claudeSessionId as string);

	await mkdir(path.dirname(resolveEndedMark({ projectKey, id: key })), { recursive: true });
	const written = await writeEndedMark({
		projectKey,
		mark: { v: 1, ...subject, endedAt: new Date().toISOString(), endedBy: "transcript", bySessionId },
	});
	return written === "written" ? { outcome: "written", id: key } : { outcome: "exists" };
}
