import resolve from "@/util/runtimePaths/resolve/index.js";
import readPresence from "@/service/observer/event/shared/readPresence/index.js";
import groupConversations from "@/service/observer/event/shared/groupConversations/index.js";
import readConversationMark from "@/service/observer/event/shared/readConversationMark/index.js";
import type { ConversationRef } from "@/service/observer/event/types/index.js";

/**
 * Whether the recording session's conversation already carries an ended mark of
 * any kind (brief commitments #135, #145). `record` starts it beside the append
 * and awaits it only when it builds the outcome, so the flag never delays a
 * recording. A session with no presence is a conversation of one. Any failure
 * counts as not ended: recording must not stall, and it never throws.
 */
export default async function readPreviouslyEnded({
	projectRoot,
	sessionId,
}: {
	projectRoot: string;
	sessionId: string;
}): Promise<boolean> {
	try {
		const { projectKey } = resolve({ projectRoot });
		const presences = await readPresence({ projectKey }).catch(() => []);
		const held = groupConversations({ presences }).find((conversation) => conversation.sessionIds.includes(sessionId));
		const conversation: ConversationRef = held
			? { sessionIds: held.sessionIds, claudeSessionIds: held.claudeSessionIds }
			: { sessionIds: [sessionId], claudeSessionIds: [] };

		return (await readConversationMark({ projectKey, conversation })) !== null;
	} catch {
		return false;
	}
}
