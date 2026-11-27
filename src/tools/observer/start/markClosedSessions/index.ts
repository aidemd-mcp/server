import read from "@/service/observer/event/read/index.js";
import readConversations from "@/service/observer/event/readConversations/index.js";
import readLiveness from "@/service/observer/event/readLiveness/index.js";
import markClosed from "@/service/observer/event/markClosed/index.js";
import resolve from "@/util/runtimePaths/resolve/index.js";
import type { ConversationRef, SessionLiveness } from "@/types/index.js";

/**
 * Marks the project's other closed conversations before the start check decides (brief commitments
 * #122, #130): every conversation that does not hold one of the caller's ids, whose newest logged
 * session reads `ended` with `endedBy: "transcript"` (a presence with no log is judged on its
 * own), gets one transcript mark through the event module's `markClosed`, stamped with
 * `bySessionId`. The caller's own conversation is never marked here: its end is a verdict the
 * start check reads, not a fact to record. Best effort by design: every failure (the reads, or one
 * write) is swallowed for that call alone, because the verdict holds on read whether or not the
 * mark lands. Returns nothing and never throws.
 */
export default async function markClosedSessions({
	projectRoot,
	caller,
	bySessionId,
}: {
	projectRoot: string;
	caller: ConversationRef;
	bySessionId: string;
}): Promise<void> {
	try {
		const { projectKey } = resolve({ projectRoot });
		const [[project], conversations] = await Promise.all([read({ projectKey }), readConversations({ projectKey })]);
		const unlinked = project
			? project.unlinked
			: (await readLiveness({ projectKey, sessions: [], now: Date.now() })).unlinked;

		const sessions = project?.sessions ?? [];
		const logged = sessions.map((session) => session.sessionId);
		const holdsCaller = (conversation: ConversationRef): boolean =>
			conversation.sessionIds.some((id) => caller.sessionIds.includes(id)) ||
			conversation.claudeSessionIds.some((id) => caller.claudeSessionIds.includes(id));
		const closedFromTranscript = (liveness: SessionLiveness): boolean =>
			liveness.state === "ended" && liveness.endedBy === "transcript";

		const ids = [
			...sessions
				.filter((session) => {
					if (caller.sessionIds.includes(session.sessionId)) return false;
					const conversation = conversations.find(({ sessionIds }) => sessionIds.includes(session.sessionId));
					if (conversation && holdsCaller(conversation)) return false;
					const newest = conversation?.sessionIds.filter((id) => logged.includes(id)).at(-1) ?? session.sessionId;
					return newest === session.sessionId && closedFromTranscript(session.liveness);
				})
				.map((session) => session.sessionId),
			...unlinked
				.filter(
					(presence) =>
						!caller.claudeSessionIds.includes(presence.claudeSessionId) && closedFromTranscript(presence.liveness),
				)
				.map((presence) => presence.claudeSessionId),
		];

		await Promise.all(ids.map((id) => markClosed({ projectKey, id, bySessionId }).catch(() => undefined)));
	} catch {
		// Marks are best effort (brief #130): a failed read leaves the sessions unmarked and the verdict unchanged.
	}
}
