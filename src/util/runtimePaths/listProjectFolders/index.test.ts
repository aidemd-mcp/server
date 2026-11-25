import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

vi.mock("node:os", async (importOriginal) => {
	const actual = await importOriginal<typeof import("node:os")>();
	return { ...actual, homedir: vi.fn(() => actual.homedir()) };
});

import { homedir } from "node:os";
import listProjectFolders from "./index.js";
import resolveRoot from "../resolveRoot/index.js";

const mockHomedir = vi.mocked(homedir);

let home: string;
let appData: string;

beforeEach(async () => {
	home = await mkdtemp(path.join(tmpdir(), "aide-listfolders-home-"));
	appData = await mkdtemp(path.join(tmpdir(), "aide-listfolders-appdata-"));
	mockHomedir.mockReturnValue(home);
	vi.stubEnv("LOCALAPPDATA", appData);
	vi.stubEnv("XDG_STATE_HOME", appData);
});

afterEach(async () => {
	vi.unstubAllEnvs();
	await Promise.all([home, appData].map((folder) => rm(folder, { recursive: true, force: true })));
});

describe("listProjectFolders", () => {
	it("lists project folders sorted by key, skipping files and non-key folders", async () => {
		const { root, observerFile } = resolveRoot();
		await mkdir(path.join(root, "zeta-aaaaaa"), { recursive: true });
		await mkdir(path.join(root, "alpha-3f9a2c"), { recursive: true });
		await mkdir(path.join(root, "not-a-key"), { recursive: true });
		await writeFile(observerFile, "{}");

		expect(await listProjectFolders()).toEqual([
			{
				projectKey: "alpha-3f9a2c",
				eventsFolder: path.join(root, "alpha-3f9a2c", "events"),
				presenceFolder: path.join(root, "alpha-3f9a2c", "presence"),
				endedFolder: path.join(root, "alpha-3f9a2c", "ended"),
			},
			{
				projectKey: "zeta-aaaaaa",
				eventsFolder: path.join(root, "zeta-aaaaaa", "events"),
				presenceFolder: path.join(root, "zeta-aaaaaa", "presence"),
				endedFolder: path.join(root, "zeta-aaaaaa", "ended"),
			},
		]);
	});

	it("answers [] for a missing root and creates nothing", async () => {
		expect(await listProjectFolders()).toEqual([]);
		expect(existsSync(resolveRoot().root)).toBe(false);
	});

	it("propagates a read error other than a missing root", async () => {
		const { root } = resolveRoot();
		await writeFile(root, "a file where the root folder should be");

		await expect(listProjectFolders()).rejects.toThrow();
	});
});
