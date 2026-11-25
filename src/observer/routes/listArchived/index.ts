import readArchive from "@/service/observer/event/readArchive/index.js";
import isProjectKey from "@/util/runtimePaths/isProjectKey/index.js";
import sendJson from "../../shared/sendJson/index.js";
import summarizeSessions from "../../shared/summarizeSessions/index.js";
import type { RouteInput } from "../../types/index.js";

/**
 * GET /api/projects/:project/archive — one row per archived session of that project, in the shape
 * of the sessions list, each with the liveness `readArchive` judged (an archived session is normally
 * ended). Read from disk on every call, since archived sessions are not held in memory. A key that
 * is not a project key is 404; a project with nothing archived answers an empty list.
 */
export default async function listArchived({ res, params }: RouteInput): Promise<void> {
	const projectKey = params.project;
	if (!isProjectKey(projectKey)) {
		sendJson({ res, status: 404, body: { error: { message: "No such project." } } });
		return;
	}

	const logs = await readArchive({ projectKey });
	const held = logs.map(({ sessionId, events }) => ({ projectKey, sessionId, events }));
	const liveness = Object.fromEntries(logs.map((log) => [log.sessionId, log.liveness]));
	const sessions = summarizeSessions({ sessions: held, liveness });
	sendJson({ res, status: 200, body: { data: { sessions } } });
}
