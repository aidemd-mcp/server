import findConversation from "@/service/observer/event/findConversation/index.js";
import reopen from "@/service/observer/event/reopen/index.js";
import resolve from "@/util/runtimePaths/resolve/index.js";
import type { LinkReply, StartReply } from "../types/index.js";
import awaitOwnLink from "../awaitOwnLink/index.js";
import findOpenSessions from "../findOpenSessions/index.js";
import markClosedSessions from "../markClosedSessions/index.js";

/**
 * The start check, run once the observer answers (brief commitments #125, #129, #130): decides
 * whether this session may proceed, in an order that never spends the user's approval on
 * something that stops anyway. The caller's own link gets a moment to land, the caller's
 * conversation is looked up, and the project's other closed conversations are marked before any
 * decision (their marks stand whatever the reply). A caller whose conversation carries an ended
 * mark is stopped when the user ended it, stopped when a newer session has worked the project
 * since, halted when another conversation is open, and otherwise reopened; a hard stop and a halt
 * write nothing for the caller. A caller with no mark is halted when another conversation is open,
 * else `reply` (the link reply the start would have given) goes out unchanged. Errors from the
 * reads propagate; start turns them into a blocked reply.
 */
export default async function checkProject({
	projectRoot,
	sessionId,
	reply,
}: {
	projectRoot: string;
	sessionId: string;
	reply: LinkReply;
}): Promise<StartReply> {
	const { projectKey } = resolve({ projectRoot });

	// 1. The caller's own presence gets a moment to link to its session.
	await awaitOwnLink({ projectKey, sessionId });

	// 2. The caller's conversation, with the mark that decides its end.
	const caller = await findConversation({ projectKey, sessionId });

	// 3. Other conversations closed without a report are marked before any decision.
	await markClosedSessions({ projectRoot, caller, bySessionId: sessionId });

	// 4. The project's other open conversations.
	const open = await findOpenSessions({ projectRoot, caller });
	const halt: StartReply = { outcome: "halt", link: reply.link, open };

	// 5. A caller that was ended: hard stops first, then the halt, then the reopen.
	if (caller.mark !== null) {
		if (caller.mark.endedBy === "user") return { outcome: "stopped", reason: "user", link: reply.link };
		if (caller.newer) return { outcome: "stopped", reason: "newer", link: reply.link };
		if (open.length > 0) return halt;
		const reopened = await reopen({ projectKey, sessionId });
		if (reopened.outcome === "failed") return { outcome: "reopen-failed", detail: reopened.detail, link: reply.link };
		return { outcome: "reopened", reply };
	}

	// 6. A caller that was never ended: halted by an open conversation, else the link.
	return open.length > 0 ? halt : reply;
}
