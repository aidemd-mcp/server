import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { createServer, type IncomingHttpHeaders, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import resolveRoot from "@/util/runtimePaths/resolveRoot/index.js";
import protocol from "@/service/observer/event/shared/protocol/index.js";
import pingObserver from "./index.js";

const KEY = "alpha-3f9a2c";

type Received = { method?: string; url?: string; headers: IncomingHttpHeaders; body: string };

let appData: string;
let server: Server;
let received: Received[];
let status: number;

async function writeObserverRecord(address: string): Promise<void> {
	const { root, observerFile } = resolveRoot();
	await mkdir(root, { recursive: true });
	await writeFile(observerFile, JSON.stringify({ address, token: "tok-1", pid: process.pid, version: "1.0.0" }));
}

beforeEach(async () => {
	appData = await mkdtemp(path.join(tmpdir(), "aide-ping-observer-"));
	vi.stubEnv("AIDEMD_HOME", path.join(appData, "aidemd"));
	received = [];
	status = 202;
	server = createServer((request, response) => {
		let body = "";
		request.on("data", (chunk) => (body += chunk));
		request.on("end", () => {
			received.push({ method: request.method, url: request.url, headers: request.headers, body });
			response.statusCode = status;
			response.end("{}");
		});
	});
	await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
});

afterEach(async () => {
	vi.unstubAllEnvs();
	await new Promise<void>((done) => server.close(() => done()));
	await rm(appData, { recursive: true, force: true });
});

describe("pingObserver", () => {
	it("posts the strict body to the presence route with token and project headers", async () => {
		await writeObserverRecord(`http://127.0.0.1:${(server.address() as AddressInfo).port}`);

		const delivered = await pingObserver({ projectKey: KEY, claudeSessionId: "claude-aaaa" });

		expect(delivered).toBe(true);
		expect(received).toHaveLength(1);
		expect(received[0].method).toBe("POST");
		expect(received[0].url).toBe(protocol.presenceRoute);
		expect(received[0].headers[protocol.tokenHeader]).toBe("tok-1");
		expect(received[0].headers[protocol.projectHeader]).toBe(KEY);
		expect(received[0].headers["content-type"]).toBe("application/json");
		expect(JSON.parse(received[0].body)).toEqual({ claudeSessionId: "claude-aaaa" });
	});

	it("is false and makes no request when no observer record exists", async () => {
		expect(await pingObserver({ projectKey: KEY, claudeSessionId: "claude-aaaa" })).toBe(false);
		expect(received).toHaveLength(0);
	});

	it("is false on a non-2xx answer", async () => {
		status = 409;
		await writeObserverRecord(`http://127.0.0.1:${(server.address() as AddressInfo).port}`);

		expect(await pingObserver({ projectKey: KEY, claudeSessionId: "claude-aaaa" })).toBe(false);
	});

	it("resolves false within 400 ms when the observer never answers", async () => {
		const silent = createServer(() => {});
		await new Promise<void>((done) => silent.listen(0, "127.0.0.1", done));
		await writeObserverRecord(`http://127.0.0.1:${(silent.address() as AddressInfo).port}`);

		const startedAt = Date.now();
		const delivered = await pingObserver({ projectKey: KEY, claudeSessionId: "claude-aaaa" });
		const elapsed = Date.now() - startedAt;

		silent.closeAllConnections();
		await new Promise<void>((done) => silent.close(() => done()));
		expect(delivered).toBe(false);
		expect(elapsed).toBeLessThan(400);
	});

	it("leaves no open connection after a 202 answer", async () => {
		await writeObserverRecord(`http://127.0.0.1:${(server.address() as AddressInfo).port}`);

		await pingObserver({ projectKey: KEY, claudeSessionId: "claude-aaaa" });
		await new Promise<void>((done) => setTimeout(done, 50));

		const open = await new Promise<number>((resolve) => server.getConnections((_error, count) => resolve(count)));
		expect(open).toBe(0);
	});

	it("is false, never throwing, when the observer refuses the connection", async () => {
		await writeObserverRecord("http://127.0.0.1:1");

		expect(await pingObserver({ projectKey: KEY, claudeSessionId: "claude-aaaa" })).toBe(false);
	});
});
