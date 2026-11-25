import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/service/observer/event/shared/readObserverRecord/index.js", () => ({ default: vi.fn() }));

import readObserverRecord from "@/service/observer/event/shared/readObserverRecord/index.js";
import resolveRoot from "@/util/runtimePaths/resolveRoot/index.js";
import findRunningObserver from "./index.js";

const mockRead = vi.mocked(readObserverRecord);
const TOKEN = "a".repeat(64);
let appData: string;
let server: Server | null = null;

beforeEach(async () => {
	appData = await mkdtemp(join(tmpdir(), "aide-find-appdata-"));
	vi.stubEnv("AIDEMD_HOME", join(appData, "aidemd"));
	vi.clearAllMocks();
});

afterEach(async () => {
	vi.unstubAllEnvs();
	if (server) {
		server.closeAllConnections();
		await new Promise((done) => server!.close(done));
		server = null;
	}
	await rm(appData, { recursive: true, force: true });
});

async function listenAsObserver(data: Record<string, unknown> = { version: "2.3.4" }): Promise<string> {
	server = createServer((req, res) => {
		const ok = req.headers["x-aide-observer-token"] === TOKEN;
		res.writeHead(ok ? 200 : 401, { "Content-Type": "application/json" });
		res.end(JSON.stringify({ data: { observer: "aide-observer", ...data } }));
	});
	await new Promise<void>((done) => server!.listen(0, "127.0.0.1", done));
	return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

function portOf(address: string): number {
	return Number(new URL(address).port);
}

describe("findRunningObserver", () => {
	it("is null when there is no record", async () => {
		mockRead.mockResolvedValue(null);
		expect(await findRunningObserver()).toBeNull();
	});

	it("reads the root record and returns the address, token, pid and the probe's version", async () => {
		const address = await listenAsObserver({ version: "2.3.4" });
		mockRead.mockResolvedValue({ address, token: TOKEN, pid: process.pid, version: "0.0.1" });

		expect(await findRunningObserver()).toEqual({ address, port: portOf(address), token: TOKEN, pid: process.pid, version: "2.3.4" });
		expect(mockRead).toHaveBeenCalledTimes(1);
		expect(mockRead).toHaveBeenCalledWith({ observerFile: resolveRoot().observerFile });
	});

	it("takes the port from the record's port field", async () => {
		const address = await listenAsObserver();
		mockRead.mockResolvedValue({ address, port: 24683, token: TOKEN, pid: process.pid, version: "2.3.4" });

		expect(await findRunningObserver()).toMatchObject({ address, port: 24683 });
	});

	it("parses the port from the address when the record has no port field", async () => {
		const address = await listenAsObserver();
		mockRead.mockResolvedValue({ address, token: TOKEN, pid: process.pid, version: "2.3.4" });

		expect(await findRunningObserver()).toMatchObject({ port: portOf(address) });
	});

	it.each([{}, { version: "" }, { version: 7 }])("reports version unknown when the probe answers %j", async (data) => {
		const address = await listenAsObserver({ version: undefined, ...data });
		mockRead.mockResolvedValue({ address, token: TOKEN, pid: process.pid, version: "2.3.4" });

		expect(await findRunningObserver()).toMatchObject({ version: "unknown" });
	});

	it("ignores a record in a project folder: only the root file is read", async () => {
		mockRead.mockResolvedValue(null);
		await findRunningObserver();
		const [{ observerFile }] = mockRead.mock.calls[0]!;
		expect(observerFile).toBe(join(resolveRoot().root, "observer.json"));
	});

	it("is null when a record exists but nothing listens at its address", async () => {
		const address = await listenAsObserver();
		await new Promise((done) => server!.close(done));
		server = null;
		mockRead.mockResolvedValue({ address, token: TOKEN, pid: process.pid, version: "2.3.4" });
		expect(await findRunningObserver()).toBeNull();
	});

	it("is null, without throwing, when reading the record throws", async () => {
		mockRead.mockRejectedValue(new Error("boom"));
		await expect(findRunningObserver()).resolves.toBeNull();
	});
});
