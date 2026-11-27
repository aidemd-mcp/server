import readPresence from "@/service/observer/event/shared/readPresence/index.js";
import groupConversations from "@/service/observer/event/shared/groupConversations/index.js";
import type { ConversationRef } from "@/service/observer/event/types/index.js";

/**
 * Lists a project's conversations (brief commitments #132, #133): the project's
 * presence records grouped by `groupConversations`, the presence records
 * dropped. The start tool counts a conversation once through this. A presence
 * folder that cannot be read counts as no presence. Never writes.
 */
export default async function readConversations({ projectKey }: { projectKey: string }): Promise<ConversationRef[]> {
	const presences = await readPresence({ projectKey }).catch(() => []);

	return groupConversations({ presences }).map(({ sessionIds, claudeSessionIds }) => ({ sessionIds, claudeSessionIds }));
}
