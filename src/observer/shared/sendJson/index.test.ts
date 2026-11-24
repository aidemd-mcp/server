import type { ServerResponse } from "node:http";
import { describe, expect, it } from "vitest";
import sendJson from "./index.js";

function makeResponse() {
	const recorded: { status?: number; headers?: Record<string, string>; body?: string } = {};
	const res = {
		writeHead(status: number, headers: Record<string, string>) {
			recorded.status = status;
			recorded.headers = headers;
		},
		end(body: string) {
			recorded.body = body;
		},
	} as unknown as ServerResponse;
	return { res, recorded };
}

describe("sendJson", () => {
	it("writes the status, every security header and the JSON body", () => {
		const { res, recorded } = makeResponse();
		sendJson({ res, status: 200, body: { data: { ok: true } } });
		expect(recorded.status).toBe(200);
		expect(recorded.headers).toEqual({
			"Content-Type": "application/json; charset=utf-8",
			"Cache-Control": "no-store",
			"X-Content-Type-Options": "nosniff",
			"Referrer-Policy": "no-referrer",
			"Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
		});
		expect(JSON.parse(recorded.body ?? "")).toEqual({ data: { ok: true } });
	});

	it("adds the extra headers it is given", () => {
		const { res, recorded } = makeResponse();
		sendJson({ res, status: 503, body: { error: { message: "wait" } }, headers: { "Retry-After": "1" } });
		expect(recorded.status).toBe(503);
		expect(recorded.headers?.["Retry-After"]).toBe("1");
		expect(recorded.headers?.["Cache-Control"]).toBe("no-store");
	});

	it("never writes an Access-Control header", () => {
		const { res, recorded } = makeResponse();
		sendJson({ res, status: 200, body: {} });
		const names = Object.keys(recorded.headers ?? {}).map((name) => name.toLowerCase());
		expect(names.filter((name) => name.startsWith("access-control-"))).toEqual([]);
	});
});
