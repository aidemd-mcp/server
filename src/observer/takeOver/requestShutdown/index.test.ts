import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import requestShutdown from "./index.js";

const TOKEN = "t".repeat(64);
let server: Server | null = null;
let seen: { method?: string; url?: string; token?: unknown; contentType?: unknown; body: string } | null = null;

afterEach(async () => {
	if (server) {
		server.closeAllConnections();
		await new Promise((done) => server!.close(done));
		server = null;
	}
	seen = null;
});

async function listen(status: number): Promise<string> {
	server = createServer((req, res) => {
		let body = "";
		req.on("data", (chunk) => (body += chunk));
		req.on("end", () => {
			seen = {
				method: req.method,
				url: req.url,
				token: req.headers["x-aide-observer-token"],
				contentType: req.headers["content-type"],
				body,
			};
			res.writeHead(status, { "Content-Type": "application/json" });
			res.end("{}");
		});
	});
	await new Promise<void>((done) => server!.listen(0, "127.0.0.1", done));
	return `http://127.0.0.1:${(server!.address() as AddressInfo).port}`;
}

describe("requestShutdown", () => {
	it("posts the caller's version with the token as JSON to the shutdown route", async () => {
		const address = await listen(202);

		await requestShutdown({ observer: { address, token: TOKEN, pid: 1, version: "1.0.0" }, version: "2.0.0" });

		expect(seen).toEqual({
			method: "POST",
			url: "/api/shutdown",
			token: TOKEN,
			contentType: "application/json",
			body: JSON.stringify({ version: "2.0.0" }),
		});
	});

	it.each([
		[202, "accepted"],
		[409, "refused"],
		[401, "failed"],
		[403, "failed"],
		[500, "failed"],
	])("answers status %i as %s", async (status, expected) => {
		const address = await listen(status);

		const answer = await requestShutdown({ observer: { address, token: TOKEN, pid: 1, version: "1.0.0" }, version: "2.0.0" });

		expect(answer).toBe(expected);
	});

	it("answers failed, without throwing, when nothing listens at the address", async () => {
		const address = await listen(202);
		server!.closeAllConnections();
		await new Promise((done) => server!.close(done));
		server = null;

		const answer = await requestShutdown({ observer: { address, token: TOKEN, pid: 1, version: "1.0.0" }, version: "2.0.0" });

		expect(answer).toBe("failed");
	});
});
