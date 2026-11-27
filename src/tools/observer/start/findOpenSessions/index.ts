import read from "@/service/observer/event/read/index.js";
import readConversations from "@/service/observer/event/readConversations/index.js";
import readLiveness from "@/service/observer/event/readLiveness/index.js";
import findCurrentPipeline from "@/service/observer/status/shared/findCurrentPipeline/index.js";
import findOpenPhase from "@/service/observer/status/shared/findOpenPhase/index.js";
import resolve from "@/util/runtimePaths/resolve/index.js";
import type { ConversationRef } from "@/types/index.js";
import type { OpenSession } from "../types/index.js";

/**
 * Lists every other open conversation of the project for the HALT (brief commitments #69, #82,
 * #84, #94, #133): each logged session that is not ended, belongs to a conversation other than the
 * caller's (none of `caller.sessionIds`) and is the greatest id among the logged sessions of its
 * conversation, so a resumed conversation counts once, by its newest observer session, oldest
 * first, with its current pipeline and open phase from the same rules the status page uses; then
 * each hook presence that never linked to an observer session, is not ended and whose Claude id is
 * not one of `caller.claudeSessionIds`, named by its Claude session id with no pipeline or phase.
 * Reads only disk, never the running observer: a freshly started observer has replayed nothing, so
 * asking it would let a HALT vanish. Throws when the project's files cannot be read; the caller
 * turns that into a blocked reply.
 */
export default async function findOpenSessions({
	projectRoot,
	caller,
}: {
	projectRoot: string;
	caller: ConversationRef;
}): Promise<OpenSession[]> {
	const { projectKey } = resolve({ projectRoot });
	const [[project], conversations] = await Promise.all([read({ projectKey }), readConversations({ projectKey })]);

	// A project with presence but no log has no entry in `read`; its presence still counts (#82).
	const unlinked = project
		? project.unlinked
		: (await readLiveness({ projectKey, sessions: [], now: Date.now() })).unlinked;

	const logged = (project?.sessions ?? []).map((session) => session.sessionId);
	const isNewestOfConversation = (sessionId: string): boolean => {
		const conversation = conversations.find(({ sessionIds }) => sessionIds.includes(sessionId));
		if (!conversation) return true;
		const newest = conversation.sessionIds.filter((id) => logged.includes(id)).at(-1);
		return newest === sessionId;
	};

	const sessions = (project?.sessions ?? [])
		.filter(
			(session) =>
				session.liveness.state !== "ended" &&
				!caller.sessionIds.includes(session.sessionId) &&
				isNewestOfConversation(session.sessionId),
		)
		.map((session): OpenSession => {
			const pipeline = findCurrentPipeline({ events: session.events })?.pipeline ?? null;
			const phase = findOpenPhase({ projectRoot, events: session.events, pipeline })?.phase ?? null;
			return { id: session.sessionId, idKind: "session", liveness: session.liveness, pipeline, phase };
		});

	const claude = unlinked
		.filter(
			(presence) => presence.liveness.state !== "ended" && !caller.claudeSessionIds.includes(presence.claudeSessionId),
		)
		.map(
			(presence): OpenSession => ({
				id: presence.claudeSessionId,
				idKind: "claude",
				liveness: presence.liveness,
				pipeline: null,
				phase: null,
			}),
		);

	return [...sessions, ...claude];
}
