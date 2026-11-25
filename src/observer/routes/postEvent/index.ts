import protocol from "@/service/observer/event/shared/protocol/index.js";
import { schema } from "@/service/observer/event/shared/schema/index.js";
import isProjectKey from "@/util/runtimePaths/isProjectKey/index.js";
import broadcastProjects from "../../shared/broadcastProjects/index.js";
import sendJson from "../../shared/sendJson/index.js";
import type { RouteInput } from "../../types/index.js";
import readJsonBody from "./readJsonBody/index.js";

const POST_BODY_LIMIT = 1_048_576;

/**
 * POST /api/events — a recorder posts one event. Accepted events are pushed
 * on the stream before the HTTP response is written, then the status is
 * rebuilt and pushed, so an open page updates the moment the event lands.
 * A post never writes a file: the recorder owns the event log. The recorder's project key rides in
 * the `protocol.projectHeader` header (the body is strict) and is checked before the body is read;
 * the event is filed under that key. A key that disagrees with the one its session was first held
 * under is refused with 409 and never reaches the stream. An accepted event also refreshes the home
 * list on the unfiltered stream clients (a `projects` frame).
 */
export default async function postEvent({ req, res, ctx }: RouteInput): Promise<void> {
	const header = req.headers[protocol.projectHeader];
	if (typeof header !== "string" || !isProjectKey(header)) {
		sendJson({ res, status: 400, body: { error: { message: "Missing or invalid project key." } } });
		return;
	}
	const projectKey = header;

	const mediaType = (req.headers["content-type"] ?? "").split(";")[0].trim().toLowerCase();
	if (mediaType !== "application/json") {
		sendJson({ res, status: 415, body: { error: { message: "Content-Type must be application/json." } } });
		return;
	}

	const body = await readJsonBody({ req, limit: POST_BODY_LIMIT });
	if (body.kind === "too-large") {
		sendJson({
			res,
			status: 413,
			body: { error: { message: "Request body is too large.", details: `Limit is ${POST_BODY_LIMIT} bytes.` } },
		});
		return;
	}
	if (body.kind === "malformed") {
		sendJson({ res, status: 400, body: { error: { message: "Request body is not valid JSON.", details: body.reason } } });
		return;
	}

	const parsed = schema.safeParse(body.value);
	if (!parsed.success) {
		sendJson({ res, status: 400, body: { error: { message: "Invalid event.", details: parsed.error.message } } });
		return;
	}

	const event = parsed.data;
	const outcome = ctx.store.accept({ event, projectKey });
	if (outcome === "project-mismatch") {
		sendJson({
			res,
			status: 409,
			body: {
				error: {
					message: "Session belongs to another project.",
					details: `Session ${event.sessionId} was first seen under a different project key.`,
				},
			},
		});
		return;
	}
	if (outcome === "held") {
		sendJson({ res, status: 202, body: { data: { outcome: "held" } } });
		return;
	}
	if (outcome === "duplicate") {
		sendJson({ res, status: 200, body: { data: { outcome: "duplicate" } } });
		return;
	}

	// Push to the stream first, so the page updates before the recorder's response and the status rebuild.
	ctx.hub.broadcast({ name: "aide-event", data: { projectKey, event }, projectKey });
	sendJson({ res, status: 200, body: { data: { outcome: "accepted" } } });
	await broadcastProjects({ ctx });
	ctx.statusPusher.push(projectKey);
}
