import type { IncomingMessage } from "node:http";
import protocol from "@/service/observer/event/shared/protocol/index.js";
import type { GuardResult } from "./types/index.js";
import matchesToken from "./matchesToken/index.js";

const HOST_NAMES = ["127.0.0.1", "localhost"];

/**
 * Proves a request came from this user's machine before any routing happens:
 * Host must be the exact local name and port (defeats a domain pointed at the
 * local address), an Origin when present must be a local origin, OPTIONS is
 * refused so no CORS preflight is ever granted, and the observer's token must
 * arrive in the header or, on GET only, the protocol's token query parameter. A request
 * for a token-free route (the page shell and its assets) skips only the token
 * check; Host, Origin and method are proven for every request. Messages name
 * what failed and never the expected token.
 */
export default function guardRequest({
	req,
	url,
	port,
	token,
	tokenFree,
}: {
	req: IncomingMessage;
	url: URL;
	port: number;
	token: string;
	/** True when the matched route answers without the token (see the route table). */
	tokenFree: boolean;
}): GuardResult {
	const host = req.headers.host?.toLowerCase();
	if (!host || !HOST_NAMES.some((name) => host === `${name}:${port}`)) {
		return { ok: false, status: 403, message: "Host header is not this observer's address" };
	}

	const origin = req.headers.origin?.toLowerCase();
	if (origin !== undefined && !HOST_NAMES.some((name) => origin === `http://${name}:${port}`)) {
		return { ok: false, status: 403, message: "Origin is not this observer's address" };
	}

	if (req.method === "OPTIONS") {
		return { ok: false, status: 405, message: "OPTIONS is not supported" };
	}

	if (tokenFree) return { ok: true };

	const headerValue = req.headers[protocol.tokenHeader];
	const fromHeader = Array.isArray(headerValue) ? headerValue[0] : headerValue;
	const given = fromHeader ?? (req.method === "GET" ? url.searchParams.get(protocol.tokenQuery) : null);
	if (given === null || given === undefined || given === "") {
		return { ok: false, status: 401, message: "Observer token is missing" };
	}
	if (!matchesToken({ given, expected: token })) {
		return { ok: false, status: 401, message: "Observer token is not valid" };
	}

	return { ok: true };
}
