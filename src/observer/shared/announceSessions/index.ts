import broadcastProjects from "../broadcastProjects/index.js";
import readHeldLiveness from "../readHeldLiveness/index.js";
import summarizeSessions from "../summarizeSessions/index.js";
import type { ObserverContext } from "../../types/index.js";

/**
 * Tells the stream clients that a project's held sessions changed (after a session was archived
 * or restored, or a presence ping arrived): the project's session rows go to that project's clients
 * and the unfiltered ones, the home list to the unfiltered ones, and the status is pushed so the
 * project's view follows. Liveness is read from disk first; a project that holds no session any more
 * has no report and announces an empty list.
 */
export default async function announceSessions({
	ctx,
	projectKey,
}: {
	ctx: ObserverContext;
	projectKey: string;
}): Promise<void> {
	const liveness = await readHeldLiveness({ ctx, projectKey });
	const sessions = summarizeSessions({
		sessions: ctx.store.sessions({ projectKey }),
		liveness: liveness.get(projectKey)?.sessions ?? {},
	});
	ctx.hub.broadcast({ name: "sessions", data: { projectKey, sessions }, projectKey });
	await broadcastProjects({ ctx });
	ctx.statusPusher.push(projectKey);
}
