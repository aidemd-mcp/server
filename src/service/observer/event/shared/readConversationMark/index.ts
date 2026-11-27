import readEndedMark from "@/service/observer/event/shared/readEndedMark/index.js";
import pickDecidingMark from "@/service/observer/event/shared/readConversationMark/pickDecidingMark/index.js";
import type { EndedMark } from "@/service/observer/event/shared/endedMark/index.js";
import type { ConversationRef } from "@/service/observer/event/types/index.js";

/**
 * Reads the mark that decides a conversation's end (brief commitments #93,
 * #118, #132): every observer session id's mark and every Claude session id's
 * mark (the key of a session that never linked), in parallel, then the one
 * `pickDecidingMark` names. A missing, unreadable or malformed mark counts as
 * absent, so it never throws. Never writes.
 */
export default async function readConversationMark({
	projectKey,
	conversation,
}: {
	projectKey: string;
	conversation: ConversationRef;
}): Promise<EndedMark | null> {
	const ids = [...conversation.sessionIds, ...conversation.claudeSessionIds];
	const marks = await Promise.all(ids.map((id) => readEndedMark({ projectKey, id })));

	return pickDecidingMark({ marks: marks.filter((mark): mark is EndedMark => mark !== null) });
}
