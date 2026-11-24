import findProject from "../../shared/findProject/index.js";
import sendJson from "../../shared/sendJson/index.js";
import type { RouteInput } from "../../types/index.js";

/** GET /api/projects/:project/events[?session=<id>] — that project's held sessions, or just the named one (empty for an unknown id). */
export default async function getEvents({ res, url, params, ctx }: RouteInput): Promise<void> {
	const project = findProject({ ctx, projectKey: params.project });
	if (project.kind === "missing") {
		sendJson({ res, status: 404, body: { error: { message: "No such project." } } });
		return;
	}

	const sessionId = url.searchParams.get("session");
	const sessions =
		sessionId === null ? project.sessions : project.sessions.filter((session) => session.sessionId === sessionId);
	sendJson({ res, status: 200, body: { data: { sessions } } });
}
