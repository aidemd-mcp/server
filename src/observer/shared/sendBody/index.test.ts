import type { ServerResponse } from "node:http";
import { describe, expect, it } from "vitest";
import sendBody from "./index.js";

function makeResponse() {
	const recorded: { status?: number; headers?: Record<string, string>; body?: string | Buffer } = {};
	const res = {
		writeHead(status: number, headers: Record<string, string>) {
			recorded.status = status;
			recorded.headers = headers;
		},
		end(body: string | Buffer) {
			recorded.body = body;
		},
	} as unknown as ServerResponse;
	return { res, recorded };
}

describe("sendBody", () => {
	it("writes the status, the content type, every security header and the body", () => {
		const { res, recorded } = makeResponse();
		sendBody({ res, status: 200, contentType: "text/css; charset=utf-8", body: "a{}" });
		expect(recorded.status).toBe(200);
		expect(recorded.headers).toEqual({
			"Content-Type": "text/css; charset=utf-8",
			"Cache-Control": "no-store",
			"X-Content-Type-Options": "nosniff",
			"Referrer-Policy": "no-referrer",
			"Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
		});
		expect(recorded.body).toBe("a{}");
	});

	it("lets the caller replace the Content-Security-Policy and add headers", () => {
		const { res, recorded } = makeResponse();
		sendBody({
			res,
			status: 200,
			contentType: "text/html; charset=utf-8",
			body: "<p>",
			headers: { "Content-Security-Policy": "default-src 'self'", Vary: "Accept" },
		});
		expect(recorded.headers?.["Content-Security-Policy"]).toBe("default-src 'self'");
		expect(recorded.headers?.Vary).toBe("Accept");
		expect(recorded.headers?.["Cache-Control"]).toBe("no-store");
	});

	it("writes a Buffer body as given and never an Access-Control header", () => {
		const { res, recorded } = makeResponse();
		const body = Buffer.from("bytes");
		sendBody({ res, status: 200, contentType: "text/javascript; charset=utf-8", body });
		expect(recorded.body).toBe(body);
		expect(Object.keys(recorded.headers ?? {}).some((name) => name.toLowerCase().startsWith("access-control-"))).toBe(false);
	});
});
