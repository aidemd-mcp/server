import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import probeIndex from "./index.js";

const TOKEN = "t".repeat(64);
const servers: Server[] = [];

async function listen(handler: Parameters<typeof createServer>[1]): Promise<string> {
	const server = createServer(handler);
	servers.push(server);
	await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
	return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

afterEach(async () => {
	for (const server of servers.splice(0)) {
		server.closeAllConnections();
		await new Promise((done) => server.close(done));
	}
});

describe("probeIndex", () => {
	it("returns the version when the marker answers to the right token header", async () => {
		const address = await listen((req, res) => {
			const ok = req.headers["x-aide-observer-token"] === TOKEN;
			res.writeHead(ok ? 200 : 401, { "Content-Type": "application/json" });
			res.end(JSON.stringify(ok ? { data: { observer: "aide-observer", version: "1.2.3" } } : { error: { message: "no" } }));
		});
		expect(await probeIndex({ address, token: TOKEN })).toEqual({ version: "1.2.3" });
	});

	it("answers unknown when the marker answers without a version", async () => {
		const address = await listen((_req, res) => {
			res.writeHead(200, { "Content-Type": "application/json" });
			res.end(JSON.stringify({ data: { observer: "aide-observer" } }));
		});
		expect(await probeIndex({ address, token: TOKEN })).toEqual({ version: "unknown" });
	});

	it("is null for a body without the marker", async () => {
		const address = await listen((_req, res) => {
			res.writeHead(200, { "Content-Type": "application/json" });
			res.end(JSON.stringify({ data: { observer: "something-else" } }));
		});
		expect(await probeIndex({ address, token: TOKEN })).toBeNull();
	});

	it("is null for a 401", async () => {
		const address = await listen((_req, res) => {
			res.writeHead(401, { "Content-Type": "application/json" });
			res.end(JSON.stringify({ data: { observer: "aide-observer" } }));
		});
		expect(await probeIndex({ address, token: TOKEN })).toBeNull();
	});

	it("is null when nothing listens on the port", async () => {
		const address = await listen((_req, res) => res.end());
		const server = servers.pop()!;
		await new Promise((done) => server.close(done));
		expect(await probeIndex({ address, token: TOKEN })).toBeNull();
	});

	it("is null when the server never answers (timeout)", async () => {
		const address = await listen(() => {
			// never respond
		});
		expect(await probeIndex({ address, token: TOKEN })).toBeNull();
	});
});
