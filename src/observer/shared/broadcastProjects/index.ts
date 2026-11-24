import summarizeProjects from "../summarizeProjects/index.js";
import type { ObserverContext } from "../../types/index.js";

/**
 * Pushes the home list as a `projects` frame to the stream clients that have no project filter
 * (a filtered client watches one project and has no use for the list). Called after every
 * accepted post and every delete so the home view never lags the store.
 */
export default function broadcastProjects({ ctx }: { ctx: ObserverContext }): void {
	const projects = summarizeProjects({ sessions: ctx.store.sessions(), now: ctx.now() });
	ctx.hub.broadcast({ name: "projects", data: { projects }, unfilteredOnly: true });
}
