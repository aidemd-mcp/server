import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import http from "node:http";
import type { AddressInfo } from "node:net";
import type { ObserverContext } from "../types/index.js";

vi.mock("../routes/getStatus/index.js", () => ({ default: vi.fn() }));

import getStatus from "../routes/getStatus/index.js";
import handleRequest from "./index.js";

const TOKEN = "b".repeat(64);
const getStatusMock = getStatus as ReturnType<typeof vi.fn>;

type Reply = { status: number; headers: http.IncomingHttpHeaders; body: string };

let server: http.Server;
let port: number;
let ready: boolean;
const replies: Reply[] = [];

function makeContext(): ObserverContext {
	return {
		port,
		token: TOKEN,
		store: { isReady: () => ready },
	} as unknown as ObserverContext;
}

function request({
	method = "GET",
	path = "/",
	headers = {},
	host = `127.0.0.1:${port}`,
}: {
	method?: string;
	path?: string;
	headers?: Record<string, string>;
	host?: string;
} = {}): Promise<Reply> {
	return new Promise((resolve, reject) => {
		const req = http.request(
			{ host: "127.0.0.1", port, method, path, headers: Object.fromEntries(Object.entries({ host, "x-aide-observer-token": TOKEN, ...headers }).filter(([, value]) => value !== "")) },
			(res) => {
				const chunks: Buffer[] = [];
				res.on("data", (chunk: Buffer) => chunks.push(chunk));
				res.on("end", () => {
					const reply = { status: res.statusCode ?? 0, headers: res.headers, body: Buffer.concat(chunks).toString("utf8") };
					replies.push(reply);
					resolve(reply);
				});
			},
		);
		req.on("error", reject);
		req.end();
	});
}

beforeEach(async () => {
	vi.clearAllMocks();
	ready = true;
	server = http.createServer((req, res) => handleRequest({ ctx: makeContext() })(req, res));
	await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
	port = (server.address() as AddressInfo).port;
});

afterEach(async () => {
	await new Promise<void>((resolve) => server.close(() => resolve()));
});

describe("handleRequest — guard", () => {
	it("refuses a foreign Host with 403", async () => {
		const reply = await request({ host: `evil.example:${port}` });

		expect(reply.status).toBe(403);
	});

	it("refuses a missing token with 401", async () => {
		const reply = await request({ headers: { "x-aide-observer-token": "" } });

		expect(reply.status).toBe(401);
	});

	it("refuses a wrong token with 401", async () => {
		const reply = await request({ headers: { "x-aide-observer-token": "c".repeat(64) } });

		expect(reply.status).toBe(401);
	});

	it("refuses OPTIONS with 405 and no Access-Control headers", async () => {
		const reply = await request({ method: "OPTIONS", path: "/api/events" });

		expect(reply.status).toBe(405);
		expect(reply.headers.allow).toBe("GET, POST, DELETE");
	});
});

describe("handleRequest — token-free page routes", () => {
	const tokenless = { "x-aide-observer-token": "" };
	const html = { Accept: "text/html" };

	it.each([
		["the home page for a browser", "/", html],
		["the session page shell", "/p/p-aaaaaa/s/session-1", {}],
	])("serves %s without a token, with no token echoed", async (_name, path, headers) => {
		const reply = await request({ path, headers: { ...tokenless, ...headers } });

		expect(reply.status).toBe(200);
		expect(reply.headers["content-type"]).toBe("text/html; charset=utf-8");
		expect(reply.body).toContain("<!doctype html>");
		expect(reply.body).not.toContain(TOKEN);
		expect(reply.body).not.toContain("token");
	});

	it.each(["/assets/page.js", "/assets/page.css"])("does not demand a token for %s", async (path) => {
		const reply = await request({ path, headers: tokenless });

		// 200 when the bundle is built, 503 naming the build when not; never the token refusal.
		expect([200, 503]).toContain(reply.status);
	});

	it("answers an unlisted asset name with 404 and no token", async () => {
		const reply = await request({ path: "/assets/secret.txt", headers: tokenless });

		expect(reply.status).toBe(404);
	});

	it("ignores a wrong token on the shell instead of refusing the page", async () => {
		const reply = await request({ path: "/p/p-aaaaaa/s/session-1", headers: { "x-aide-observer-token": "c".repeat(64) } });

		expect(reply.status).toBe(200);
	});

	it("still answers GET / without text/html as JSON that needs the token", async () => {
		const bare = await request({ headers: tokenless });
		const json = await request({ headers: { ...tokenless, Accept: "application/json" } });
		const withToken = await request({ headers: { Accept: "application/json" } });

		expect(bare.status).toBe(401);
		expect(json.status).toBe(401);
		expect(withToken.status).toBe(200);
		expect(JSON.parse(withToken.body).data.observer).toBe("aide-observer");
	});

	it.each(["/", "/p/p-aaaaaa/s/session-1", "/assets/page.js"])("still refuses a foreign Host on %s with 403", async (path) => {
		const reply = await request({ path, host: `evil.example:${port}`, headers: { ...tokenless, ...html } });

		expect(reply.status).toBe(403);
	});

	it.each(["/", "/p/p-aaaaaa/s/session-1", "/assets/page.js"])("still refuses a foreign Origin on %s with 403", async (path) => {
		const reply = await request({ path, headers: { ...tokenless, ...html, Origin: "http://evil.example" } });

		expect(reply.status).toBe(403);
	});

	it("still refuses a tokenless OPTIONS on a shell path with 405", async () => {
		const reply = await request({ method: "OPTIONS", path: "/p/p-aaaaaa/s/session-1", headers: tokenless });

		expect(reply.status).toBe(405);
	});
});

describe("handleRequest — data routes need the token", () => {
	it.each([
		["GET", "/api/projects"],
		["GET", "/api/projects/p-aaaaaa/status"],
		["GET", "/api/projects/p-aaaaaa/events"],
		["GET", "/api/projects/p-aaaaaa/file?path=a.txt"],
		["GET", "/api/projects/p-aaaaaa/task/some-task"],
		["GET", "/api/projects/p-aaaaaa/sessions"],
		["POST", "/api/projects/p-aaaaaa/sessions/session-1/archive"],
		["GET", "/api/projects/p-aaaaaa/archive"],
		["POST", "/api/projects/p-aaaaaa/archive/session-1/restore"],
		["DELETE", "/api/projects/p-aaaaaa/archive/session-1"],
		["GET", "/api/stream"],
		["POST", "/api/events"],
		["POST", "/api/shutdown"],
	])("answers %s %s with 401 and no token, also when Accept lists text/html", async (method, path) => {
		const bare = await request({ method, path, headers: { "x-aide-observer-token": "" } });
		const asHtml = await request({ method, path, headers: { "x-aide-observer-token": "", Accept: "text/html" } });

		expect(bare.status).toBe(401);
		expect(asHtml.status).toBe(401);
	});

	it("answers an unknown path and a wrong method with 401 when no token is sent", async () => {
		expect((await request({ path: "/nope", headers: { "x-aide-observer-token": "" } })).status).toBe(401);
		expect((await request({ method: "PUT", path: "/", headers: { "x-aide-observer-token": "" } })).status).toBe(401);
	});
});

describe("handleRequest — routing", () => {
	it("answers an unknown path with 404", async () => {
		const reply = await request({ path: "/nope" });

		expect(reply.status).toBe(404);
	});

	it("answers a wrong method with 405 and Allow", async () => {
		const reply = await request({ method: "PUT", path: "/api/projects/p-aaaaaa/sessions" });

		expect(reply.status).toBe(405);
		expect(reply.headers.allow).toBe("GET");
	});

	it("accepts the token as a query parameter on GET", async () => {
		const reply = await request({ path: `/?token=${TOKEN}`, headers: { "x-aide-observer-token": "" } });

		expect(reply.status).toBe(200);
	});
});

describe("handleRequest — readiness gate", () => {
	it("answers a read route with 503 and Retry-After during replay, while GET / still answers", async () => {
		ready = false;

		const status = await request({ path: "/api/projects/p-aaaaaa/status" });
		const index = await request({ path: "/" });

		expect(status.status).toBe(503);
		expect(status.headers["retry-after"]).toBe("1");
		expect(index.status).toBe(200);
		expect(JSON.parse(index.body).data.ready).toBe(false);
		expect(getStatusMock).not.toHaveBeenCalled();
	});
});

describe("handleRequest — handler failure", () => {
	it("answers 500 when a handler throws, and the next request still succeeds", async () => {
		const stderr = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
		getStatusMock.mockRejectedValueOnce(new Error("boom"));

		const failed = await request({ path: "/api/projects/p-aaaaaa/status" });
		const next = await request({ path: "/" });

		expect(failed.status).toBe(500);
		expect(JSON.parse(failed.body)).toEqual({ error: { message: "Internal error" } });
		expect(next.status).toBe(200);
		expect(stderr).toHaveBeenCalledWith(expect.stringContaining("boom"));
		stderr.mockRestore();
	});
});

describe("handleRequest — no CORS anywhere", () => {
	it("never wrote an Access-Control header on any response of this suite", () => {
		const offending = replies.flatMap((reply) => Object.keys(reply.headers)).filter((name) => name.startsWith("access-control-"));

		expect(offending).toEqual([]);
	});
});
