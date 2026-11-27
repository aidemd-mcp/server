import { unlink } from "node:fs/promises";
import resolveEndedMark from "@/util/runtimePaths/resolveEndedMark/index.js";
import readPresence from "@/service/observer/event/shared/readPresence/index.js";
import groupConversations from "@/service/observer/event/shared/groupConversations/index.js";
import type { ConversationRef, ReopenOutcome } from "@/service/observer/event/types/index.js";

/**
 * Reopens the caller's conversation (brief commitments #123, #136): removes
 * the ended mark of every observer session id and Claude session id in the
 * conversation that holds `sessionId`, and nothing else: no log, presence or
 * link is touched. A mark that is not there is not an error. Every removal is
 * attempted; the first other failure is reported as `failed`, else `reopened`
 * carries the number of marks removed. Never throws.
 */
export default async function reopen({
	projectKey,
	sessionId,
}: {
	projectKey: string;
	sessionId: string;
}): Promise<ReopenOutcome> {
	const presences = await readPresence({ projectKey }).catch(() => []);
	const held = groupConversations({ presences }).find((conversation) => conversation.sessionIds.includes(sessionId));
	const conversation: ConversationRef = held
		? { sessionIds: held.sessionIds, claudeSessionIds: held.claudeSessionIds }
		: { sessionIds: [sessionId], claudeSessionIds: [] };

	const results = await Promise.all(
		[...conversation.sessionIds, ...conversation.claudeSessionIds].map(async (id): Promise<{ removed: boolean; failure?: string }> => {
			try {
				await unlink(resolveEndedMark({ projectKey, id }));
				return { removed: true };
			} catch (error) {
				if ((error as NodeJS.ErrnoException).code === "ENOENT") return { removed: false };
				return { removed: false, failure: error instanceof Error ? error.message : String(error) };
			}
		}),
	);

	const failure = results.find((result) => result.failure !== undefined);
	if (failure) return { outcome: "failed", detail: failure.failure as string };
	return { outcome: "reopened", cleared: results.filter((result) => result.removed).length };
}
