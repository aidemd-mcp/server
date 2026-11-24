import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { createServer, type Server } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import resolveRoot from "@/util/runtimePaths/resolveRoot/index.js";
import view from "./index.js";

describe("view with a busy port", () => {
	let blocker: Server | undefined;
	let tempRoot: string | undefined;
	let appData: string | undefined;
	let originalErr: typeof process.stderr.write;
	let originalLocalAppData: string | undefined;
	let originalXdgStateHome: string | undefined;

	beforeEach(() => {
		originalLocalAppData = process.env.LOCALAPPDATA;
		originalXdgStateHome = process.env.XDG_STATE_HOME;
		appData = mkdtempSync(join(tmpdir(), "aide-view-appdata-"));
		process.env.LOCALAPPDATA = appData;
		process.env.XDG_STATE_HOME = appData;
	});

	afterEach(async () => {
		if (originalErr) process.stderr.write = originalErr;
		if (blocker) await new Promise<void>((done) => blocker!.close(() => done()));
		if (tempRoot) rmSync(tempRoot, { recursive: true, force: true });
		if (appData) rmSync(appData, { recursive: true, force: true });
		if (originalLocalAppData === undefined) delete process.env.LOCALAPPDATA;
		else process.env.LOCALAPPDATA = originalLocalAppData;
		if (originalXdgStateHome === undefined) delete process.env.XDG_STATE_HOME;
		else process.env.XDG_STATE_HOME = originalXdgStateHome;
		blocker = undefined;
		tempRoot = undefined;
		appData = undefined;
	});

	it("exits 1 naming the port and writes no observer.json", async () => {
		blocker = createServer();
		await new Promise<void>((done) => blocker!.listen(0, "127.0.0.1", () => done()));
		const address = blocker.address();
		if (address === null || typeof address === "string") throw new Error("blocker has no port");
		const { port } = address;

		tempRoot = mkdtempSync(join(tmpdir(), "aide-view-"));
		let stderr = "";
		originalErr = process.stderr.write;
		process.stderr.write = ((chunk: string) => {
			stderr += chunk;
			return true;
		}) as typeof process.stderr.write;

		const code = await view({ args: ["--port", String(port)], projectRoot: tempRoot });

		expect(code).toBe(1);
		expect(stderr).toContain(String(port));
		const { observerFile } = resolveRoot();
		expect(observerFile.startsWith(appData!)).toBe(true);
		expect(existsSync(observerFile)).toBe(false);
	});
});
