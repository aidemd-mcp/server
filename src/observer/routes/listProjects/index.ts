import sendJson from "../../shared/sendJson/index.js";
import summarizeProjects from "../../shared/summarizeProjects/index.js";
import type { RouteInput } from "../../types/index.js";

/** GET /api/projects — the home list: every held project with its reported root, session rows and latest event time. */
export default async function listProjects({ res, ctx }: RouteInput): Promise<void> {
	const projects = summarizeProjects({ sessions: ctx.store.sessions(), now: ctx.now() });
	sendJson({ res, status: 200, body: { data: { projects } } });
}
