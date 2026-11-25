import readHeldLiveness from "../readHeldLiveness/index.js";
import summarizeProjects from "../summarizeProjects/index.js";
import type { ObserverContext } from "../../types/index.js";

/**
 * Pushes the home list as a `projects` frame to the stream clients that have no project filter
 * (a filtered client watches one project and has no use for the list). Reads liveness from disk
 * first, so the frame carries what the recording side says now. Called after every accepted post,
 * presence ping and archive change so the home view never lags the store.
 */
export default async function broadcastProjects({ ctx }: { ctx: ObserverContext }): Promise<void> {
	const liveness = await readHeldLiveness({ ctx });
	const projects = summarizeProjects({ sessions: ctx.store.sessions(), liveness });
	ctx.hub.broadcast({ name: "projects", data: { projects }, unfilteredOnly: true });
}
