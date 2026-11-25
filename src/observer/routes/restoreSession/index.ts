import restoreSessionLog from "@/service/observer/event/restore/index.js";
import isProjectKey from "@/util/runtimePaths/isProjectKey/index.js";
import announceSessions from "../../shared/announceSessions/index.js";
import sendJson from "../../shared/sendJson/index.js";
import type { RouteInput } from "../../types/index.js";

/**
 * POST /api/projects/:project/archive/<id>/restore — moves one archived session's log back into
 * the project's events and holds its events again, so it returns to every session list. The project
 * is addressed by key alone, since a project whose sessions are all archived holds none in memory:
 * a key that is not a project key is 404, and so is a session that is not archived. A log already
 * in the events folder under that id answers 409 and nothing moves. An outcome the route does not
 * know throws. On success the project's session rows and the home list are broadcast and its status
 * is pushed.
 */
export default async function restoreSession({ res, params, ctx }: RouteInput): Promise<void> {
	const { project: projectKey, id } = params;
	if (!isProjectKey(projectKey)) {
		sendJson({ res, status: 404, body: { error: { message: "No such project." } } });
		return;
	}

	const result = await restoreSessionLog({ projectKey, sessionId: id });

	if (result.outcome === "invalid-id") {
		sendJson({ res, status: 400, body: { error: { message: "Invalid session id.", details: result.detail } } });
		return;
	}
	if (result.outcome === "not-found") {
		sendJson({ res, status: 404, body: { error: { message: `Archived session ${id} was not found.` } } });
		return;
	}
	if (result.outcome === "exists") {
		sendJson({
			res,
			status: 409,
			body: { error: { message: `Session ${id} already exists in the project's history; it was not restored.` } },
		});
		return;
	}
	if (result.outcome !== "restored") {
		// Exhaustiveness: a new restore outcome fails to compile here and throws at runtime, never reaching success.
		const unhandled: never = result;
		throw new Error(`Unhandled restore outcome: ${JSON.stringify(unhandled)}`);
	}

	for (const event of result.session.events) ctx.store.accept({ event, projectKey });
	sendJson({ res, status: 200, body: { data: { restored: id } } });
	await announceSessions({ ctx, projectKey });
}
