import { stat } from "node:fs/promises";
import create from "@/util/runtimePaths/create/index.js";
import resolveArchivedLog from "@/util/runtimePaths/resolveArchivedLog/index.js";
import resolveSessionLog from "@/util/runtimePaths/resolveSessionLog/index.js";
import isSessionId from "@/util/runtimePaths/shared/isSessionId/index.js";
import readPresence from "@/service/observer/event/shared/readPresence/index.js";
import groupConversations from "@/service/observer/event/shared/groupConversations/index.js";
import judgeConversation from "@/service/observer/event/shared/judgeConversation/index.js";
import readConversationMark from "@/service/observer/event/shared/readConversationMark/index.js";
import writeEndedMark from "@/service/observer/event/shared/writeEndedMark/index.js";
import type { Conversation, EndSessionOutcome } from "@/service/observer/event/types/index.js";

/** True when a file exists at `path`; any stat failure counts as absent. */
async function exists(path: string): Promise<boolean> {
	return stat(path).then(
		() => true,
		() => false,
	);
}

/** The mark's subject for `id`, or null when nothing in this project carries it. */
async function findTarget({
	projectKey,
	id,
	presence,
}: {
	projectKey: string;
	id: string;
	presence: { sessionId?: string } | undefined;
}): Promise<{ sessionId: string } | { claudeSessionId: string } | null> {
	if (presence) return presence.sessionId ? { sessionId: presence.sessionId } : { claudeSessionId: id };

	const known =
		(await exists(resolveSessionLog({ projectKey, sessionId: id }))) ||
		(await exists(resolveArchivedLog({ projectKey, sessionId: id })));
	return known ? { sessionId: id } : null;
}

/** The conversation holding the observer session id or the Claude id the target names, else a conversation of one. */
function conversationOf({
	conversations,
	target,
}: {
	conversations: Conversation[];
	target: { sessionId: string } | { claudeSessionId: string };
}): Conversation {
	const held = conversations.find((conversation) =>
		"sessionId" in target
			? conversation.sessionIds.includes(target.sessionId)
			: conversation.claudeSessionIds.includes(target.claudeSessionId),
	);
	if (held) return held;
	return "sessionId" in target
		? { sessionIds: [target.sessionId], claudeSessionIds: [], presences: [] }
		: { sessionIds: [], claudeSessionIds: [target.claudeSessionId], presences: [] };
}

/**
 * Ends another session of the caller's own project by writing its ended mark with `endedBy:
 * "user"` (brief commitments #74, #93, #118, #132); deletes nothing, ever. Works per conversation:
 * a conversation already carrying an ended mark on any of its sessions answers `already-ended`
 * and nothing is written; one judged closed from its transcript (and unmarked) gets the
 * `transcript` mark, written by the caller, and answers `already-ended` too, since the user was
 * never asked to end it. `id` names an observer session of
 * this project (its log is in the events or the archive folder) or the Claude session id of one of
 * its hook presences: a presence linked to an observer session ends that session, an unlinked one
 * gets a mark keyed by its Claude id. The caller's own conversation (every observer session and
 * Claude session of it, earlier ones included) is refused. A bad id, an own session and an unknown id come back as values, never as
 * thrown errors; a failed filesystem read or write propagates.
 */
export default async function endSession({
	projectRoot,
	id,
	bySessionId,
}: {
	projectRoot: string;
	id: string;
	bySessionId: string;
}): Promise<EndSessionOutcome> {
	if (!isSessionId(id)) return { outcome: "invalid-id", detail: `Invalid session id "${id}"` };
	if (id === bySessionId) return { outcome: "own-session", id };

	// The project's key and folders, the same ones the recorder and the hook use.
	const { projectKey } = await create({ projectRoot });

	// One read of the project's presence, grouped into conversations.
	const presences = await readPresence({ projectKey });
	const conversations = groupConversations({ presences });

	// The caller's own conversation: any of its observer or Claude ids is refused.
	const own = conversations.find(({ sessionIds }) => sessionIds.includes(bySessionId));
	if (own && (own.sessionIds.includes(id) || own.claudeSessionIds.includes(id))) return { outcome: "own-session", id };

	// A Claude session id of this project: the presence says whose session it is.
	const presence = presences.find((record) => record.claudeSessionId === id);
	const target = await findTarget({ projectKey, id, presence });
	if (!target) return { outcome: "unknown", id };

	// Judge the target's whole conversation, the way every reader does (no events: only marks, presence and transcript).
	const conversation = conversationOf({ conversations, target });
	const liveness = await judgeConversation({ projectKey, conversation, events: [], now: Date.now() });
	if (liveness.state === "ended") {
		if ((await readConversationMark({ projectKey, conversation })) !== null) return { outcome: "already-ended", id };
		if (liveness.endedBy === "transcript") {
			await writeEndedMark({
				projectKey,
				mark: { v: 1, ...target, endedAt: new Date().toISOString(), endedBy: "transcript", bySessionId },
			});
			return { outcome: "already-ended", id };
		}
	}

	const written = await writeEndedMark({
		projectKey,
		mark: { v: 1, ...target, endedAt: new Date().toISOString(), endedBy: "user", bySessionId },
	});
	return { outcome: written === "written" ? "ended" : "already-ended", id };
}
