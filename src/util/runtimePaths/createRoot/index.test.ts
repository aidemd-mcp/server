import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { existsSync } from "node:fs";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

vi.mock("node:os", async (importOriginal) => {
	const actual = await importOriginal<typeof import("node:os")>();
	return { ...actual, homedir: vi.fn(() => actual.homedir()) };
});

import { homedir } from "node:os";
import createRoot from "./index.js";
import resolveRoot from "../resolveRoot/index.js";

const mockHomedir = vi.mocked(homedir);

let home: string;
let appData: string;

beforeEach(async () => {
	home = await mkdtemp(path.join(tmpdir(), "aide-createroot-home-"));
	appData = await mkdtemp(path.join(tmpdir(), "aide-createroot-appdata-"));
	mockHomedir.mockReturnValue(home);
	vi.stubEnv("LOCALAPPDATA", appData);
	vi.stubEnv("XDG_STATE_HOME", appData);
});

afterEach(async () => {
	vi.unstubAllEnvs();
	await Promise.all([home, appData].map((folder) => rm(folder, { recursive: true, force: true })));
});

describe("createRoot", () => {
	it("creates the app-data root and returns the resolved root paths", async () => {
		const paths = await createRoot();

		expect(paths).toEqual(resolveRoot());
		expect(path.dirname(paths.root)).toBe(appData);
		expect(existsSync(paths.root)).toBe(true);
	});

	it("is idempotent", async () => {
		const first = await createRoot();
		const second = await createRoot();

		expect(second).toEqual(first);
		expect(existsSync(first.root)).toBe(true);
	});

	it("creates no observer.json and no project folder", async () => {
		const paths = await createRoot();

		expect(existsSync(paths.observerFile)).toBe(false);
		expect(await readdir(paths.root)).toEqual([]);
	});
});
