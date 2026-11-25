import broadcastProjects from "../broadcastProjects/index.js";
import summarizeSessions from "../summarizeSessions/index.js";
import type { ObserverContext } from "../../types/index.js";

/**
 * Tells the stream clients that a project's held sessions changed (after a session was archived
 * or restored): the project's session rows go to that project's clients and the unfiltered ones, the
 * home list to the unfiltered ones, and the status is pushed so the project's view follows.
 */
export default function announceSessions({ ctx, projectKey }: { ctx: ObserverContext; projectKey: string }): void {
	ctx.hub.broadcast({
		name: "sessions",
		data: { projectKey, sessions: summarizeSessions({ sessions: ctx.store.sessions({ projectKey }), now: ctx.now() }) },
		projectKey,
	});
	broadcastProjects({ ctx });
	ctx.statusPusher.push(projectKey);
}
