import archiveSessionLog from "@/service/observer/event/archive/index.js";
import announceSessions from "../../shared/announceSessions/index.js";
import findProject from "../../shared/findProject/index.js";
import sendJson from "../../shared/sendJson/index.js";
import type { RouteInput } from "../../types/index.js";

/**
 * POST /api/projects/:project/sessions/<id>/archive — moves one past session's log of that project
 * into the project's archive and drops it from memory, so it leaves every session list until it is
 * restored. An unknown project is 404. A session that has not ended is refused, and so is an
 * unreadable one (it cannot be judged ended): both answer 409 and nothing is dropped, broadcast or pushed. An outcome
 * the route does not know throws. On success the project's session rows and the home list are
 * broadcast and its status is pushed. A throw from the move (a broken runtime location) propagates
 * to handleRequest's 500.
 */
export default async function archiveSession({ res, params, ctx }: RouteInput): Promise<void> {
	const project = findProject({ ctx, projectKey: params.project });
	if (project.kind === "missing") {
		sendJson({ res, status: 404, body: { error: { message: "No such project." } } });
		return;
	}

	const id = params.id;
	const { projectKey } = project;
	const result = await archiveSessionLog({ projectKey, sessionId: id });

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
			body: { error: { message: `Session ${id} has not ended; only an ended session can be archived.` } },
		});
		return;
	}
	if (result.outcome === "unreadable") {
		sendJson({
			res,
			status: 409,
			body: {
				error: { message: `Session ${id} could not be read, so it cannot be judged ended; it was not archived.` },
			},
		});
		return;
	}
	if (result.outcome !== "archived") {
		// Exhaustiveness: a new archive outcome fails to compile here and throws at runtime, never reaching success.
		const unhandled: never = result;
		throw new Error(`Unhandled archive outcome: ${JSON.stringify(unhandled)}`);
	}

	ctx.store.drop({ projectKey, sessionId: id });
	sendJson({ res, status: 200, body: { data: { archived: id } } });
	await announceSessions({ ctx, projectKey });
}
