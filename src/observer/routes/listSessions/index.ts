import findProject from "../../shared/findProject/index.js";
import sendJson from "../../shared/sendJson/index.js";
import summarizeSessions from "../../shared/summarizeSessions/index.js";
import type { RouteInput } from "../../types/index.js";

/** GET /api/projects/:project/sessions — one row per session of that project with its liveness. */
export default async function listSessions({ res, params, ctx }: RouteInput): Promise<void> {
	const project = findProject({ ctx, projectKey: params.project });
	if (project.kind === "missing") {
		sendJson({ res, status: 404, body: { error: { message: "No such project." } } });
		return;
	}

	const sessions = summarizeSessions({ sessions: project.sessions, now: ctx.now() });
	sendJson({ res, status: 200, body: { data: { sessions } } });
}
