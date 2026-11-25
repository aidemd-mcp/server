import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, writeFile, mkdir } from "node:fs/promises";
import { createServer, type IncomingHttpHeaders, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";

vi.mock("node:os", async (importOriginal) => {
	const actual = await importOriginal<typeof import("node:os")>();
	return { ...actual, homedir: vi.fn(() => actual.homedir()) };
});
vi.mock("@/util/isProcessRunning/index.js", () => ({ default: vi.fn() }));

import { homedir } from "node:os";
import isProcessRunning from "@/util/isProcessRunning/index.js";
import resolve from "@/util/runtimePaths/resolve/index.js";
import resolveRoot from "@/util/runtimePaths/resolveRoot/index.js";
import postToObserver from "./index.js";
import type { ObserverEvent } from "@/service/observer/event/shared/schema/index.js";

const mockHomedir = vi.mocked(homedir);
const mockIsProcessRunning = vi.mocked(isProcessRunning);

type Received = { method?: string; url?: string; headers: IncomingHttpHeaders; body: string };

let home: string;
let appData: string;
let project: string;
let server: Server;
let received: Received[];
let respond: (response: import("node:http").ServerResponse) => void;

function makeEvent(overrides: Partial<ObserverEvent> = {}): ObserverEvent {
	return {
		v: 1,
		ts: "2026-11-22T10:00:00.000Z",
		sessionId: "20261122T100000000Z-abc123",
		seq: 1,
		pid: 4242,
		kind: "release",
		version: "1.2.3",
		...overrides,
	} as ObserverEvent;
}

async function writeObserverRecord(record: object): Promise<void> {
	const paths = resolveRoot();
	await mkdir(paths.root, { recursive: true });
	await writeFile(paths.observerFile, JSON.stringify(record));
}

function serverAddress(): string {
	return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

beforeEach(async () => {
	vi.clearAllMocks();
	mockIsProcessRunning.mockReturnValue(true);
	home = await mkdtemp(path.join(tmpdir(), "aide-post-home-"));
	appData = await mkdtemp(path.join(tmpdir(), "aide-post-appdata-"));
	project = await mkdtemp(path.join(tmpdir(), "aide-post-project-"));
	mockHomedir.mockReturnValue(home);
	vi.stubEnv("AIDEMD_HOME", path.join(appData, "aidemd"));

	received = [];
	respond = (response) => response.writeHead(200).end("ok");
	server = createServer((request, response) => {
		const chunks: Buffer[] = [];
		request.on("data", (chunk: Buffer) => chunks.push(chunk));
		request.on("end", () => {
			received.push({
				method: request.method,
				url: request.url,
				headers: request.headers,
				body: Buffer.concat(chunks).toString("utf-8"),
			});
			respond(response);
		});
	});
	await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
});

afterEach(async () => {
	server.closeAllConnections();
	await new Promise<void>((done) => server.close(() => done()));
	vi.unstubAllEnvs();
	await Promise.all([home, appData, project].map((folder) => rm(folder, { recursive: true, force: true })));
});

describe("postToObserver", () => {
	it("returns true on a 200 answer and sends the exact event, header and token to the events route", async () => {
		await writeObserverRecord({ address: serverAddress(), token: "secret-token", pid: process.pid, version: "1.0.0" });
		const event = makeEvent();

		const delivered = await postToObserver({ projectRoot: project, event });

		expect(delivered).toBe(true);
		expect(received).toHaveLength(1);
		expect(received[0]!.method).toBe("POST");
		expect(received[0]!.url).toBe("/api/events");
		expect(received[0]!.body).toBe(JSON.stringify(event));
		expect(received[0]!.headers["content-type"]).toBe("application/json");
		expect(received[0]!.headers["x-aide-observer-token"]).toBe("secret-token");
		expect(received[0]!.headers["x-aide-observer-project"]).toBe(resolve({ projectRoot: project }).projectKey);
	});

	it("reads only the root record, ignoring one left in the project folder", async () => {
		const paths = resolve({ projectRoot: project });
		await mkdir(paths.folder, { recursive: true });
		await writeFile(path.join(paths.folder, "observer.json"), JSON.stringify({ address: serverAddress(), token: "t", pid: process.pid, version: "1.0.0" }));

		expect(await postToObserver({ projectRoot: project, event: makeEvent() })).toBe(false);
		expect(received).toHaveLength(0);
	});

	it("returns false on a 500 answer", async () => {
		respond = (response) => response.writeHead(500).end("boom");
		await writeObserverRecord({ address: serverAddress(), token: "t", pid: process.pid, version: "1.0.0" });

		expect(await postToObserver({ projectRoot: project, event: makeEvent() })).toBe(false);
	});

	it("returns false within a second when the observer answers after 2 seconds", async () => {
		respond = (response) => {
			setTimeout(() => response.writeHead(200).end("late"), 2000);
		};
		await writeObserverRecord({ address: serverAddress(), token: "t", pid: process.pid, version: "1.0.0" });

		const started = Date.now();
		const delivered = await postToObserver({ projectRoot: project, event: makeEvent() });

		expect(delivered).toBe(false);
		expect(Date.now() - started).toBeLessThan(1000);
	});

	it("returns false and makes no request when there is no observer.json", async () => {
		expect(await postToObserver({ projectRoot: project, event: makeEvent() })).toBe(false);
		expect(received).toHaveLength(0);
	});

	it("returns false when observer.json points at a closed port", async () => {
		const address = serverAddress();
		server.closeAllConnections();
		await new Promise<void>((done) => server.close(() => done()));
		await writeObserverRecord({ address, token: "t", pid: process.pid, version: "1.0.0" });

		expect(await postToObserver({ projectRoot: project, event: makeEvent() })).toBe(false);

		await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
	});

	it("returns false and makes no request when the observer pid is dead", async () => {
		mockIsProcessRunning.mockReturnValue(false);
		await writeObserverRecord({ address: serverAddress(), token: "t", pid: process.pid, version: "1.0.0" });

		expect(await postToObserver({ projectRoot: project, event: makeEvent() })).toBe(false);
		expect(received).toHaveLength(0);
	});

	it("returns false without throwing for a relative project root", async () => {
		expect(await postToObserver({ projectRoot: "relative/root", event: makeEvent() })).toBe(false);
	});
});
