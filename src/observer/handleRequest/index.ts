import describeError from "@/util/describeError/index.js";
import type { IncomingMessage, ServerResponse } from "node:http";
import guardRequest from "../guardRequest/index.js";
import sendJson from "../shared/sendJson/index.js";
import type { ObserverContext } from "../types/index.js";
import isTokenFree from "./isTokenFree/index.js";
import matchRoute from "./matchRoute/index.js";

/**
 * Builds the request listener of the observer. Every request runs the same
 * recipe: parse the URL, match it against the route table, prove it came from this user
 * (guardRequest: Host and Origin always, the token unless the route is the page shell or an
 * allowlisted asset), refuse an unknown path or method, hold read routes back until the replay is done, then run the
 * handler. A handler that throws costs one request a 500 and one stderr
 * line; the server keeps serving.
 */
export default function handleRequest({ ctx }: { ctx: ObserverContext }): (req: IncomingMessage, res: ServerResponse) => void {
	return (req, res) => {
		void serve({ req, res, ctx });
	};
}

async function serve({ req, res, ctx }: { req: IncomingMessage; res: ServerResponse; ctx: ObserverContext }): Promise<void> {
	// 1. Parse the request URL against the observer's own origin.
	let url: URL;
	try {
		url = new URL(req.url ?? "/", `http://127.0.0.1:${ctx.port}`);
	} catch {
		sendJson({ res, status: 400, body: { error: { message: "Request URL is malformed." } } });
		return;
	}

	// 2. Match the route (pure lookup; nothing runs and nothing is answered yet).
	const match = matchRoute({ method: req.method ?? "GET", pathname: url.pathname });

	// 3. Guard: Host, Origin and method for every request, the token unless the matched route is token-free.
	const tokenFree = match.kind === "route" && isTokenFree({ tokenAccess: match.tokenAccess, accept: req.headers.accept });
	const guard = guardRequest({ req, url, port: ctx.port, token: ctx.token, tokenFree });
	if (!guard.ok) {
		const headers = guard.status === 405 ? { Allow: "GET, POST, DELETE" } : undefined;
		sendJson({ res, status: guard.status, body: { error: { message: guard.message } }, headers });
		return;
	}

	// 4. An unknown path is 404, a wrong method is 405 with Allow.
	if (match.kind === "not-found") {
		sendJson({ res, status: 404, body: { error: { message: "No such route." } } });
		return;
	}
	if (match.kind === "method-not-allowed") {
		sendJson({
			res,
			status: 405,
			body: { error: { message: "Method not allowed for this route." } },
			headers: { Allow: match.allow.join(", ") },
		});
		return;
	}

	// 5. Readiness gate: read routes wait for the replay to finish.
	if (match.readRoute && !ctx.store.isReady()) {
		sendJson({
			res,
			status: 503,
			body: { error: { message: "The observer is still loading history; retry shortly." } },
			headers: { "Retry-After": "1" },
		});
		return;
	}

	// 6. Run the handler; a throw is answered with a 500 and the server keeps serving.
	try {
		await match.handler({ req, res, url, params: match.params, ctx });
	} catch (error) {
		const message = describeError({ error });
		process.stderr.write(`observer: ${req.method} ${url.pathname} failed: ${message}\n`);
		if (res.headersSent) {
			res.destroy();
			return;
		}
		sendJson({ res, status: 500, body: { error: { message: "Internal error" } } });
	}
}
