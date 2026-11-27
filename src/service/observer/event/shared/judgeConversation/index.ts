import readConversationMark from "@/service/observer/event/shared/readConversationMark/index.js";
import readTranscriptActivity from "@/service/observer/event/shared/readTranscriptActivity/index.js";
import readClosingRecord from "@/service/observer/event/shared/readClosingRecord/index.js";
import judgeLiveness from "@/service/observer/event/shared/judgeLiveness/index.js";
import pickNewestPresence from "@/service/observer/event/shared/judgeConversation/pickNewestPresence/index.js";
import type { ObserverEvent } from "@/service/observer/event/shared/schema/index.js";
import type { Conversation, SessionLiveness } from "@/service/observer/event/types/index.js";

/**
 * One judgement per conversation (brief commitments #132, #133): every session
 * of a conversation reads the same liveness. The newest presence of the
 * conversation speaks; the deciding ended mark is read across every observer
 * and Claude id of the conversation, beside that presence's transcript
 * activity and whether its transcript ends in the session's own closing
 * record, all in parallel, then handed to the pure rule. A mark or transcript
 * that cannot be read counts as absent, so one bad file never fails the
 * judgement. Nothing is written.
 */
export default async function judgeConversation({
	projectKey,
	conversation,
	events,
	now,
}: {
	projectKey: string;
	conversation: Conversation;
	events: ObserverEvent[];
	now: number;
}): Promise<SessionLiveness> {
	const presence = pickNewestPresence({ presences: conversation.presences });

	const [endedMark, transcriptActivityAt, transcriptClosed] = await Promise.all([
		readConversationMark({ projectKey, conversation }),
		readTranscriptActivity({ transcriptPath: presence?.transcriptPath }),
		presence === null
			? false
			: readClosingRecord({ transcriptPath: presence.transcriptPath, claudeSessionId: presence.claudeSessionId }),
	]);

	return judgeLiveness({ events, presence, endedMark, transcriptActivityAt, transcriptClosed, now });
}
