import isVersionBehind from "@/util/isVersionBehind/index.js";
import sendJson from "../../shared/sendJson/index.js";
import { schema } from "../../shared/shutdownRequest/index.js";
import type { RouteInput } from "../../types/index.js";
import readJsonBody from "../postEvent/readJsonBody/index.js";

const BODY_LIMIT = 4_096;

/**
 * POST /api/shutdown — a newer caller asks this observer to stop so it can take over the port.
 * guardRequest has already proved Host, the token header (the query token is never accepted on a
 * POST) and, when present, a local Origin. This route then refuses any `Origin` header outright: a
 * page always sends one, the user's own tools (Node `fetch`) send none, so a page can never trigger
 * it. The body must be JSON `{ version }`. The observer stops only when the caller's version is
 * strictly newer than its own (`isVersionBehind`, false when either side is unparseable), else 409
 * and it keeps serving. On acceptance it answers 202 and calls `ctx.shutdown()` once the response
 * has finished, so the caller always receives its answer. Never a page control (brief commitment
 * #34, #43).
 */
export default async function postShutdown({ req, res, ctx }: RouteInput): Promise<void> {
	if (req.headers.origin !== undefined) {
		sendJson({ res, status: 403, body: { error: { message: "The shutdown request is for local tools only." } } });
		return;
	}

	const mediaType = (req.headers["content-type"] ?? "").split(";")[0].trim().toLowerCase();
	if (mediaType !== "application/json") {
		sendJson({ res, status: 415, body: { error: { message: "Content-Type must be application/json." } } });
		return;
	}

	const body = await readJsonBody({ req, limit: BODY_LIMIT });
	if (body.kind === "too-large") {
		sendJson({ res, status: 413, body: { error: { message: "Request body is too large.", details: `Limit is ${BODY_LIMIT} bytes.` } } });
		return;
	}
	if (body.kind === "malformed") {
		sendJson({ res, status: 400, body: { error: { message: "Request body is not valid JSON.", details: body.reason } } });
		return;
	}

	const parsed = schema.safeParse(body.value);
	if (!parsed.success) {
		sendJson({ res, status: 400, body: { error: { message: "Invalid shutdown request.", details: parsed.error.message } } });
		return;
	}

	const callerVersion = parsed.data.version;
	if (!isVersionBehind(ctx.version, callerVersion)) {
		sendJson({
			res,
			status: 409,
			body: {
				error: {
					message: "The caller is not newer than this observer.",
					details: `Observer version ${ctx.version}, caller version ${callerVersion}.`,
				},
			},
		});
		return;
	}

	// Connection: close lets the caller's socket end once the 202 is written; the stop that follows
	// closes every remaining connection.
	res.once("finish", () => ctx.shutdown());
	sendJson({
		res,
		status: 202,
		body: { data: { stopping: true, version: ctx.version } },
		headers: { Connection: "close" },
	});
}
