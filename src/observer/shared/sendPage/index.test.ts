import type { ServerResponse } from "node:http";
import { describe, expect, it } from "vitest";
import sendPage from "./index.js";

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

describe("sendPage", () => {
	it("answers 200 text/html with the token-free shell and the strict CSP", () => {
		const { res, recorded } = makeResponse();

		sendPage({ res });

		expect(recorded.status).toBe(200);
		expect(recorded.headers?.["Content-Type"]).toBe("text/html; charset=utf-8");
		expect(recorded.headers?.["Content-Security-Policy"]).toBe(
			"default-src 'none'; script-src 'self'; style-src 'self'; font-src data:; img-src 'self' data:; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
		);
		expect(recorded.headers?.["Cache-Control"]).toBe("no-store");
		expect(recorded.headers?.["X-Content-Type-Options"]).toBe("nosniff");
		expect(recorded.headers?.["Referrer-Policy"]).toBe("no-referrer");
		expect(String(recorded.body)).toContain('src="/assets/page.js"');
	});

	it("adds the caller's headers and never an Access-Control header", () => {
		const { res, recorded } = makeResponse();

		sendPage({ res, headers: { Vary: "Accept" } });

		expect(recorded.headers?.Vary).toBe("Accept");
		expect(Object.keys(recorded.headers ?? {}).some((name) => name.toLowerCase().startsWith("access-control-"))).toBe(false);
	});
});
