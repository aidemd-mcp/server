import { spawn, type ChildProcess } from "node:child_process";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../findRunningObserver/index.js", () => ({ default: vi.fn() }));
vi.mock("./awaitExit/index.js", () => ({ default: vi.fn() }));

import isProcessRunning from "@/util/isProcessRunning/index.js";
import findRunningObserver from "../findRunningObserver/index.js";
import type { RunningObserver } from "../types/index.js";
import awaitExit from "./awaitExit/index.js";
import takeOver from "./index.js";

const mockFind = vi.mocked(findRunningObserver);
const mockAwaitExit = vi.mocked(awaitExit);

let server: Server | null = null;
let child: ChildProcess | null = null;
let requests: { url?: string; token?: unknown; body: string }[] = [];

beforeEach(() => {
	vi.clearAllMocks();
	requests = [];
});

afterEach(async () => {
	if (server) {
		server.closeAllConnections();
		await new Promise((done) => server!.close(done));
		server = null;
	}
	child?.kill();
	child = null;
});

/** A local stand-in for the old observer's shutdown route that answers `status` and records what it was sent. */
async function listenAsOldObserver({ status, version }: { status: number; version: string }): Promise<RunningObserver> {
	server = createServer((req, res) => {
		let body = "";
		req.on("data", (chunk) => (body += chunk));
		req.on("end", () => {
			requests.push({ url: req.url, token: req.headers["x-aide-observer-token"], body });
			res.writeHead(status, { "Content-Type": "application/json" });
			res.end("{}");
		});
	});
	await new Promise<void>((done) => server!.listen(0, "127.0.0.1", done));
	const { port } = server!.address() as AddressInfo;
	const address = `http://127.0.0.1:${port}`;
	return { address, port, token: "t".repeat(64), pid: 4242, version };
}

describe("takeOver", () => {
	it("answers none when nothing is running", async () => {
		mockFind.mockResolvedValue(null);

		await expect(takeOver({ version: "2.0.0" })).resolves.toEqual({ outcome: "none" });
		expect(mockAwaitExit).not.toHaveBeenCalled();
	});

	it.each([
		["the same version", "2.0.0"],
		["a newer version", "3.0.0"],
		["an unparseable version", "unknown"],
	])("keeps a running observer on %s and sends no shutdown request", async (_label, runningVersion) => {
		const running = await listenAsOldObserver({ status: 202, version: runningVersion });
		mockFind.mockResolvedValue(running);

		await expect(takeOver({ version: "2.0.0" })).resolves.toEqual({ outcome: "kept", observer: running });
		expect(requests).toEqual([]);
		expect(mockAwaitExit).not.toHaveBeenCalled();
	});

	it("keeps the caller's own unparseable version from replacing anything", async () => {
		const running = await listenAsOldObserver({ status: 202, version: "1.0.0" });
		mockFind.mockResolvedValue(running);

		await expect(takeOver({ version: "dev" })).resolves.toEqual({ outcome: "kept", observer: running });
		expect(requests).toEqual([]);
	});

	it("replaces an older observer: sends the caller's version, waits for the pid, reports it replaced", async () => {
		const running = await listenAsOldObserver({ status: 202, version: "1.0.0" });
		mockFind.mockResolvedValue(running);
		mockAwaitExit.mockResolvedValue(true);

		await expect(takeOver({ version: "2.0.0" })).resolves.toEqual({ outcome: "replaced", previous: running });
		expect(requests).toEqual([{ url: "/api/shutdown", token: running.token, body: JSON.stringify({ version: "2.0.0" }) }]);
		expect(mockAwaitExit).toHaveBeenCalledWith({ pid: running.pid, timeoutMs: 3000, intervalMs: 100 });
	});

	it("keeps an older observer that refuses the shutdown with 409, without waiting", async () => {
		const running = await listenAsOldObserver({ status: 409, version: "1.0.0" });
		mockFind.mockResolvedValue(running);

		await expect(takeOver({ version: "2.0.0" })).resolves.toEqual({ outcome: "kept", observer: running });
		expect(requests).toHaveLength(1);
		expect(mockAwaitExit).not.toHaveBeenCalled();
	});

	it("still waits for the pid when the shutdown request failed, and reports stuck if it stays", async () => {
		const running = await listenAsOldObserver({ status: 500, version: "1.0.0" });
		mockFind.mockResolvedValue(running);
		mockAwaitExit.mockResolvedValue(false);

		await expect(takeOver({ version: "2.0.0" })).resolves.toEqual({ outcome: "stuck", observer: running });
		expect(mockAwaitExit).toHaveBeenCalledTimes(1);
	});

	it("reports stuck and never kills an older observer that answers 202 but keeps running past 3 s", async () => {
		const real = await vi.importActual<typeof import("./awaitExit/index.js")>("./awaitExit/index.js");
		mockAwaitExit.mockImplementation(real.default);
		child = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"], { stdio: "ignore" });
		const pid = child.pid!;
		const old = await listenAsOldObserver({ status: 202, version: "1.0.0" });
		const running = { ...old, pid };
		mockFind.mockResolvedValue(running);

		const answer = await takeOver({ version: "2.0.0" });

		expect(answer).toEqual({ outcome: "stuck", observer: running });
		expect(isProcessRunning(pid)).toBe(true);
	}, 10_000);
});
