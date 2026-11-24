import { describe, it, expect } from "vitest";
import type { IncomingMessage } from "node:http";
import guardRequest from "./index.js";

const PORT = 4321;
const TOKEN = "a".repeat(64);

function makeRequest({
	method = "GET",
	headers = {},
}: {
	method?: string;
	headers?: Record<string, string | undefined>;
} = {}): IncomingMessage {
	return {
		method,
		headers: { host: `127.0.0.1:${PORT}`, "x-aide-observer-token": TOKEN, ...headers },
	} as unknown as IncomingMessage;
}

function guard(req: IncomingMessage, query = "", tokenFree = false) {
	return guardRequest({
		req,
		url: new URL(`http://127.0.0.1:${PORT}/${query}`),
		port: PORT,
		token: TOKEN,
		tokenFree,
	});
}

describe("guardRequest — Host", () => {
	it.each([`127.0.0.1:${PORT}`, `localhost:${PORT}`, `LOCALHOST:${PORT}`, `LocalHost:${PORT}`])(
		"accepts %s",
		(host) => {
			expect(guard(makeRequest({ headers: { host } }))).toEqual({ ok: true });
		},
	);

	it.each([
		`evil.example:${PORT}`,
		`127.0.0.1:${PORT + 1}`,
		"127.0.0.1",
		`[::1]:${PORT}`,
		`attacker.test:${PORT}`,
	])("refuses %s with 403", (host) => {
		expect(guard(makeRequest({ headers: { host } }))).toMatchObject({ ok: false, status: 403 });
	});

	it("refuses a missing Host with 403", () => {
		expect(guard(makeRequest({ headers: { host: undefined } }))).toMatchObject({
			ok: false,
			status: 403,
		});
	});
});

describe("guardRequest — Origin", () => {
	it.each([`http://127.0.0.1:${PORT}`, `http://localhost:${PORT}`])("accepts %s", (origin) => {
		expect(guard(makeRequest({ headers: { origin } }))).toEqual({ ok: true });
	});

	it("accepts a request with no Origin", () => {
		expect(guard(makeRequest())).toEqual({ ok: true });
	});

	it.each(["http://evil.example", `http://evil.example:${PORT}`, `http://127.0.0.1:${PORT + 1}`, "null"])(
		"refuses Origin %s with 403",
		(origin) => {
			expect(guard(makeRequest({ headers: { origin } }))).toMatchObject({
				ok: false,
				status: 403,
			});
		},
	);
});

describe("guardRequest — method", () => {
	it("refuses OPTIONS with 405", () => {
		expect(guard(makeRequest({ method: "OPTIONS" }))).toMatchObject({ ok: false, status: 405 });
	});
});

describe("guardRequest — token", () => {
	it("accepts the right header", () => {
		expect(guard(makeRequest())).toEqual({ ok: true });
	});

	it("accepts the right query parameter on GET", () => {
		const req = makeRequest({ headers: { "x-aide-observer-token": undefined } });
		expect(guard(req, `?token=${TOKEN}`)).toEqual({ ok: true });
	});

	it.each(["POST", "DELETE"])("refuses the query parameter on %s with 401", (method) => {
		const req = makeRequest({ method, headers: { "x-aide-observer-token": undefined } });
		expect(guard(req, `?token=${TOKEN}`)).toMatchObject({ ok: false, status: 401 });
	});

	it("accepts the right header on POST", () => {
		expect(guard(makeRequest({ method: "POST" }))).toEqual({ ok: true });
	});

	it("refuses a missing token with 401", () => {
		const req = makeRequest({ headers: { "x-aide-observer-token": undefined } });
		expect(guard(req)).toMatchObject({ ok: false, status: 401 });
	});

	it.each(["b".repeat(64), "a".repeat(63), "a".repeat(65), "x"])(
		"refuses the wrong token %s with 401",
		(wrong) => {
			const req = makeRequest({ headers: { "x-aide-observer-token": wrong } });
			expect(guard(req)).toMatchObject({ ok: false, status: 401 });
		},
	);

	it("refuses a wrong query token on GET with 401", () => {
		const req = makeRequest({ headers: { "x-aide-observer-token": undefined } });
		expect(guard(req, `?token=${"b".repeat(64)}`)).toMatchObject({ ok: false, status: 401 });
	});

	it("never puts the expected token in a failure message", () => {
		const req = makeRequest({ headers: { "x-aide-observer-token": "b".repeat(64) } });
		const result = guard(req);
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.message).not.toContain(TOKEN);
	});
});

describe("guardRequest — token-free routes", () => {
	const tokenless = { "x-aide-observer-token": undefined };

	it("lets a tokenless request through", () => {
		expect(guard(makeRequest({ headers: tokenless }), "", true)).toEqual({ ok: true });
	});

	it("lets a request with a wrong token through, since the token is not checked", () => {
		expect(guard(makeRequest({ headers: { "x-aide-observer-token": "x" } }), "", true)).toEqual({ ok: true });
	});

	it.each([`evil.example:${PORT}`, `127.0.0.1:${PORT + 1}`])("still refuses Host %s with 403", (host) => {
		expect(guard(makeRequest({ headers: { ...tokenless, host } }), "", true)).toMatchObject({ ok: false, status: 403 });
	});

	it.each(["http://evil.example", "null"])("still refuses Origin %s with 403", (origin) => {
		expect(guard(makeRequest({ headers: { ...tokenless, origin } }), "", true)).toMatchObject({ ok: false, status: 403 });
	});

	it("still refuses OPTIONS with 405", () => {
		expect(guard(makeRequest({ method: "OPTIONS", headers: tokenless }), "", true)).toMatchObject({ ok: false, status: 405 });
	});
});
