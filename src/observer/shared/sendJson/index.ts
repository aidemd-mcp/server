import type { ServerResponse } from "node:http";
import sendBody from "../sendBody/index.js";

/**
 * The observer's JSON writer: it hands the serialized body to sendBody, which owns the security
 * headers, so no second copy of them exists. It never writes an Access-Control-* header: the
 * observer allows no cross-origin use at all.
 */
export default function sendJson({
	res,
	status,
	body,
	headers = {},
}: {
	res: ServerResponse;
	status: number;
	body: unknown;
	headers?: Record<string, string>;
}): void {
	sendBody({
		res,
		status,
		contentType: "application/json; charset=utf-8",
		body: JSON.stringify(body),
		headers,
	});
}
