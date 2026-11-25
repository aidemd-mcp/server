import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { createServer, type Server } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The test owns the port list: the real list is never walked, so no real port (24680 included) is bound.
const portList = vi.hoisted(() => ({ ports: [] as number[] }));

vi.mock("@/service/observer/event/shared/protocol/index.js", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/service/observer/event/shared/protocol/index.js")>();
	return {
		default: {
			...actual.default,
			get ports() {
				return portList.ports;
			},
		},
	};
});

import resolveRoot from "@/util/runtimePaths/resolveRoot/index.js";
import view from "./index.js";

const TEST_TIMEOUT_MS = 5000;

/** Binds a server on a free loopback port the test then holds, so the port is busy for the observer. */
async function holdPort(): Promise<{ server: Server; port: number }> {
	const server = createServer();
	await new Promise<void>((done) => server.listen(0, "127.0.0.1", () => done()));
	const address = server.address();
	if (address === null || typeof address === "string") throw new Error("held server has no port");
	return { server, port: address.port };
}

/** A port that was free a moment ago: bound on 0, read, then released. */
async function findFreePort(): Promise<number> {
	const { server, port } = await holdPort();
	await new Promise<void>((done) => server.close(() => done()));
	return port;
}

describe("view on a port list the test controls", () => {
	let held: Server[];
	let tempRoot: string | undefined;
	let appData: string | undefined;
	let stdout: string;
	let stderr: string;
	let originalOut: typeof process.stdout.write;
	let originalErr: typeof process.stderr.write;
	let originalAidemdHome: string | undefined;
	let originalEnvPort: string | undefined;

	beforeEach(() => {
		held = [];
		originalAidemdHome = process.env.AIDEMD_HOME;
		originalEnvPort = process.env.AIDE_OBSERVER_PORT;
		appData = mkdtempSync(join(tmpdir(), "aide-view-appdata-"));
		process.env.AIDEMD_HOME = join(appData, "aidemd");
		delete process.env.AIDE_OBSERVER_PORT;
		tempRoot = mkdtempSync(join(tmpdir(), "aide-view-"));

		stdout = "";
		stderr = "";
		originalOut = process.stdout.write;
		originalErr = process.stderr.write;
		process.stdout.write = ((chunk: string) => {
			stdout += chunk;
			return true;
		}) as typeof process.stdout.write;
		process.stderr.write = ((chunk: string) => {
			stderr += chunk;
			return true;
		}) as typeof process.stderr.write;
	});

	afterEach(async () => {
		process.stdout.write = originalOut;
		process.stderr.write = originalErr;
		for (const server of held) await new Promise<void>((done) => server.close(() => done()));
		portList.ports = [];
		if (tempRoot) rmSync(tempRoot, { recursive: true, force: true });
		if (appData) rmSync(appData, { recursive: true, force: true });
		if (originalAidemdHome === undefined) delete process.env.AIDEMD_HOME;
		else process.env.AIDEMD_HOME = originalAidemdHome;
		if (originalEnvPort === undefined) delete process.env.AIDE_OBSERVER_PORT;
		else process.env.AIDE_OBSERVER_PORT = originalEnvPort;
		held = [];
		tempRoot = undefined;
		appData = undefined;
	});

	it(
		"exits 1 naming every port in order when none on the list can be bound, and writes no observer.json",
		async () => {
			const first = await holdPort();
			const second = await holdPort();
			held.push(first.server, second.server);
			portList.ports = [first.port, second.port];

			const code = await view({ args: ["--port", String(first.port)], projectRoot: tempRoot! });

			expect(code).toBe(1);
			const firstAt = stderr.indexOf(`${first.port} (`);
			const secondAt = stderr.indexOf(`${second.port} (`);
			expect(firstAt).toBeGreaterThanOrEqual(0);
			expect(secondAt).toBeGreaterThan(firstAt);
			expect(stderr).toContain("is busy");
			expect(stdout).toBe("");
			const { observerFile } = resolveRoot();
			expect(observerFile.startsWith(appData!)).toBe(true);
			expect(existsSync(observerFile)).toBe(false);
		},
		TEST_TIMEOUT_MS,
	);

	it(
		"walks past a busy first port, prints the port note and the link on the port it got, and exits 0",
		async () => {
			const busy = await holdPort();
			held.push(busy.server);
			const free = await findFreePort();
			portList.ports = [busy.port, free];

			const running = view({ args: ["--port", String(busy.port)], projectRoot: tempRoot! });
			await vi.waitFor(() => expect(stdout).toContain("Observer running at"), { timeout: TEST_TIMEOUT_MS });

			expect(stdout).toContain(`Port ${busy.port} was not used; the observer is on port ${free}.\n`);
			expect(stdout).toContain(`http://127.0.0.1:${free}`);
			const { observerFile } = resolveRoot();
			expect(existsSync(observerFile)).toBe(true);

			process.emit("SIGINT");
			await expect(running).resolves.toBe(0);
			expect(existsSync(observerFile)).toBe(false);
		},
		TEST_TIMEOUT_MS,
	);
});
