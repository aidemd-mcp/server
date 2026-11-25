import protocol from "@/service/observer/event/shared/protocol/index.js";
import { schema } from "@/service/observer/event/shared/presencePing/index.js";
import isProjectKey from "@/util/runtimePaths/isProjectKey/index.js";
import announceSessions from "../../shared/announceSessions/index.js";
import broadcastProjects from "../../shared/broadcastProjects/index.js";
import sendJson from "../../shared/sendJson/index.js";
import type { RouteInput } from "../../types/index.js";
import readJsonBody from "../postEvent/readJsonBody/index.js";

const PING_BODY_LIMIT = 4_096;

/**
 * POST /api/presence — a hook reports that a Claude session's presence just changed. The ping
 * carries no state: it names the Claude session and nothing else, and liveness is re-read from
 * disk (brief #10, #75, #99). The guards are postEvent's: the project key rides in the
 * `protocol.projectHeader` header and is checked before the body is read, the content type must be
 * `application/json`, and the body is read with the same reader under a 4 096-byte limit and parsed
 * with the presence ping schema (strict). An accepted ping answers 202; then, once the store is
 * ready, a project the store holds gets its sessions and status pushed, and any other project gets
 * the home list pushed. A ping never writes a file, and a failed push is written to stderr only.
 */
export default async function postPresence({ req, res, ctx }: RouteInput): Promise<void> {
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

	const body = await readJsonBody({ req, limit: PING_BODY_LIMIT });
	if (body.kind === "too-large") {
		sendJson({
			res,
			status: 413,
			body: { error: { message: "Request body is too large.", details: `Limit is ${PING_BODY_LIMIT} bytes.` } },
		});
		return;
	}
	if (body.kind === "malformed") {
		sendJson({ res, status: 400, body: { error: { message: "Request body is not valid JSON.", details: body.reason } } });
		return;
	}

	const parsed = schema.safeParse(body.value);
	if (!parsed.success) {
		sendJson({ res, status: 400, body: { error: { message: "Invalid presence ping.", details: parsed.error.message } } });
		return;
	}

	sendJson({ res, status: 202, body: { data: { outcome: "accepted" } } });
	if (!ctx.store.isReady()) return;

	try {
		if (ctx.store.sessions({ projectKey }).length > 0) {
			await announceSessions({ ctx, projectKey });
		} else {
			await broadcastProjects({ ctx });
		}
	} catch (error) {
		process.stderr.write(`observer: presence push failed: ${error instanceof Error ? error.message : String(error)}\n`);
	}
}
