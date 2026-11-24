import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import http from "node:http";
import type { AddressInfo } from "node:net";
import protocol from "@/service/observer/event/shared/protocol/index.js";
import handleRequest from "../../handleRequest/index.js";
import type { ObserverContext } from "../../types/index.js";

const TOKEN = "d".repeat(64);
const OBSERVER_VERSION = "1.2.3";

let server: http.Server;
let port: number;
let shutdown: ReturnType<typeof vi.fn>;

type Reply = { status: number; headers: http.IncomingHttpHeaders; body: string };

function request({
	method = "POST",
	headers = {},
	body,
}: {
	method?: string;
	headers?: Record<string, string>;
	body?: string;
} = {}): Promise<Reply> {
	return new Promise((resolve, reject) => {
		const req = http.request(
			{
				host: "127.0.0.1",
				port,
				method,
				path: protocol.shutdownRoute,
				headers: { host: `127.0.0.1:${port}`, [protocol.tokenHeader]: TOKEN, "content-type": "application/json", ...headers },
			},
			(res) => {
				const chunks: Buffer[] = [];
				res.on("data", (chunk: Buffer) => chunks.push(chunk));
				res.on("end", () => resolve({ status: res.statusCode ?? 0, headers: res.headers, body: Buffer.concat(chunks).toString("utf8") }));
			},
		);
		req.on("error", reject);
		req.end(body);
	});
}

function ask(version: string, headers: Record<string, string> = {}): Promise<Reply> {
	return request({ body: JSON.stringify({ version }), headers });
}

beforeEach(async () => {
	shutdown = vi.fn();
	const ctx = {
		get port() {
			return port;
		},
		token: TOKEN,
		version: OBSERVER_VERSION,
		store: { isReady: () => true },
		shutdown,
	} as unknown as ObserverContext;
	server = http.createServer((req, res) => handleRequest({ ctx })(req, res));
	await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
	port = (server.address() as AddressInfo).port;
});

afterEach(async () => {
	server.closeAllConnections();
	await new Promise<void>((resolve) => server.close(() => resolve()));
});

describe("postShutdown — who may ask", () => {
	it("refuses a request with no token with 401 and does not stop", async () => {
		const reply = await ask("9.9.9", { [protocol.tokenHeader]: "" });

		expect(reply.status).toBe(401);
		expect(shutdown).not.toHaveBeenCalled();
	});

	it("refuses a wrong token with 401 and does not stop", async () => {
		const reply = await ask("9.9.9", { [protocol.tokenHeader]: "e".repeat(64) });

		expect(reply.status).toBe(401);
		expect(shutdown).not.toHaveBeenCalled();
	});

	it("refuses a token carried only in the query string", async () => {
		const reply = await new Promise<Reply>((resolve, reject) => {
			const req = http.request(
				{
					host: "127.0.0.1",
					port,
					method: "POST",
					path: `${protocol.shutdownRoute}?token=${TOKEN}`,
					headers: { host: `127.0.0.1:${port}`, "content-type": "application/json" },
				},
				(res) => {
					res.resume();
					res.on("end", () => resolve({ status: res.statusCode ?? 0, headers: res.headers, body: "" }));
				},
			);
			req.on("error", reject);
			req.end(JSON.stringify({ version: "9.9.9" }));
		});

		expect(reply.status).toBe(401);
		expect(shutdown).not.toHaveBeenCalled();
	});

	it.each([
		["a foreign site", "https://evil.example"],
		["this observer's own origin", "http://127.0.0.1:{port}"],
		["null", "null"],
	])("refuses a request carrying an Origin header (%s) with 403, even with the right token", async (_label, origin) => {
		const reply = await ask("9.9.9", { origin: origin.replace("{port}", String(port)) });

		expect(reply.status).toBe(403);
		expect(shutdown).not.toHaveBeenCalled();
	});

	it("answers GET on the route with 405", async () => {
		const reply = await request({ method: "GET", headers: { "content-type": "" } });

		expect(reply.status).toBe(405);
		expect(shutdown).not.toHaveBeenCalled();
	});
});

describe("postShutdown — the body", () => {
	it("refuses a body that is not application/json with 415", async () => {
		const reply = await request({ body: JSON.stringify({ version: "9.9.9" }), headers: { "content-type": "text/plain" } });

		expect(reply.status).toBe(415);
		expect(shutdown).not.toHaveBeenCalled();
	});

	it.each([
		["an empty object", "{}"],
		["an empty version", JSON.stringify({ version: "" })],
		["an unknown key", JSON.stringify({ version: "9.9.9", extra: true })],
		["a non-string version", JSON.stringify({ version: 9 })],
		["malformed JSON", "{nope"],
	])("answers 400 for %s", async (_label, body) => {
		const reply = await request({ body });

		expect(reply.status).toBe(400);
		expect(shutdown).not.toHaveBeenCalled();
	});
});

describe("postShutdown — the version rule", () => {
	it.each([
		["equal", OBSERVER_VERSION],
		["older", "1.2.2"],
		["much older", "0.9.0"],
		["unparseable", "unknown"],
		["unparseable text", "latest"],
	])("answers 409 naming both versions and keeps serving when the caller is %s", async (_label, caller) => {
		const reply = await ask(caller);

		expect(reply.status).toBe(409);
		const { error } = JSON.parse(reply.body) as { error: { details: string } };
		expect(error.details).toContain(OBSERVER_VERSION);
		expect(error.details).toContain(caller);
		expect(shutdown).not.toHaveBeenCalled();
		expect((await request({ method: "GET", headers: { "content-type": "" } })).status).toBe(405);
	});

	it("never replaces anything when the observer's own version is unparseable", async () => {
		await new Promise<void>((resolve) => server.close(() => resolve()));
		const ctx = { port: 0, token: TOKEN, version: "unknown", store: { isReady: () => true }, shutdown } as unknown as ObserverContext;
		server = http.createServer((req, res) => handleRequest({ ctx: { ...ctx, port } })(req, res));
		await new Promise<void>((resolve) => server.listen(port, "127.0.0.1", resolve));

		const reply = await ask("99.0.0");

		expect(reply.status).toBe(409);
		expect(shutdown).not.toHaveBeenCalled();
	});

	it("answers 202 and stops only after the response has finished when the caller is newer", async () => {
		const reply = await ask("1.2.4");

		expect(reply.status).toBe(202);
		expect(JSON.parse(reply.body)).toEqual({ data: { stopping: true, version: OBSERVER_VERSION } });
		await vi.waitFor(() => expect(shutdown).toHaveBeenCalledTimes(1));
	});
});
