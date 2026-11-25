import deleteSessionLog from "@/service/observer/event/delete/index.js";
import isProjectKey from "@/util/runtimePaths/isProjectKey/index.js";
import sendJson from "../../shared/sendJson/index.js";
import type { RouteInput } from "../../types/index.js";

/**
 * DELETE /api/projects/:project/archive/<id> — permanently removes one archived session's log of
 * that project. Only an archived session can be deleted, so the session must be archived first; a
 * session still in the project's history (live or past) is 404 here. The project is addressed by
 * key alone, since archived sessions are not held in memory: a key that is not a project key is
 * 404. Nothing held changes, so nothing is broadcast. An outcome the route does not know throws, and
 * a throw from the delete (a broken runtime location) propagates to handleRequest's 500.
 */
export default async function deleteSession({ res, params }: RouteInput): Promise<void> {
	const { project: projectKey, id } = params;
	if (!isProjectKey(projectKey)) {
		sendJson({ res, status: 404, body: { error: { message: "No such project." } } });
		return;
	}

	const result = await deleteSessionLog({ projectKey, sessionId: id });

	if (result.outcome === "invalid-id") {
		sendJson({ res, status: 400, body: { error: { message: "Invalid session id.", details: result.detail } } });
		return;
	}
	if (result.outcome === "not-found") {
		sendJson({ res, status: 404, body: { error: { message: `Archived session ${id} was not found.` } } });
		return;
	}
	if (result.outcome !== "deleted") {
		// Exhaustiveness: a new delete outcome fails to compile here and throws at runtime, never reaching success.
		const unhandled: never = result;
		throw new Error(`Unhandled delete outcome: ${JSON.stringify(unhandled)}`);
	}

	sendJson({ res, status: 200, body: { data: { deleted: id } } });
}
