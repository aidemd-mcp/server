import deleteSessionLog from "@/service/observer/event/delete/index.js";
import broadcastProjects from "../../shared/broadcastProjects/index.js";
import findProject from "../../shared/findProject/index.js";
import sendJson from "../../shared/sendJson/index.js";
import summarizeSessions from "../../shared/summarizeSessions/index.js";
import type { RouteInput } from "../../types/index.js";

/**
 * DELETE /api/projects/:project/sessions/<id> — removes one past session's log of that project
 * and drops it from memory. An unknown project is 404. A live session is refused, and so is an unreadable one (it
 * cannot be judged past): both answer 409 and nothing is dropped, broadcast
 * or pushed. An outcome the route does not know throws. On success the project's session rows are
 * broadcast (to that project's stream clients and the unfiltered ones), the home list is broadcast to
 * the unfiltered clients and its status is pushed. A throw from the delete (a broken
 * runtime location) propagates to handleRequest's 500.
 */
export default async function deleteSession({ res, params, ctx }: RouteInput): Promise<void> {
	const project = findProject({ ctx, projectKey: params.project });
	if (project.kind === "missing") {
		sendJson({ res, status: 404, body: { error: { message: "No such project." } } });
		return;
	}

	const id = params.id;
	const { projectKey } = project;
	const result = await deleteSessionLog({ projectKey, sessionId: id });

	if (result.outcome === "invalid-id") {
		sendJson({ res, status: 400, body: { error: { message: "Invalid session id.", details: result.detail } } });
		return;
	}
	if (result.outcome === "not-found") {
		sendJson({ res, status: 404, body: { error: { message: `Session ${id} was not found.` } } });
		return;
	}
	if (result.outcome === "live") {
		sendJson({
			res,
			status: 409,
			body: { error: { message: `Session ${id} is still live; only a past session can be deleted.` } },
		});
		return;
	}
	if (result.outcome === "unreadable") {
		sendJson({
			res,
			status: 409,
			body: {
				error: { message: `Session ${id} could not be read, so it cannot be judged past; it was not deleted.` },
			},
		});
		return;
	}
	if (result.outcome !== "deleted") {
		// Exhaustiveness: a new delete outcome fails to compile here and throws at runtime, never reaching success.
		const unhandled: never = result;
		throw new Error(`Unhandled delete outcome: ${JSON.stringify(unhandled)}`);
	}

	ctx.store.drop({ projectKey, sessionId: id });
	ctx.hub.broadcast({
		name: "sessions",
		data: { projectKey, sessions: summarizeSessions({ sessions: ctx.store.sessions({ projectKey }), now: ctx.now() }) },
		projectKey,
	});
	broadcastProjects({ ctx });
	sendJson({ res, status: 200, body: { data: { deleted: id } } });
	ctx.statusPusher.push(projectKey);
}
