import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { existsSync } from "node:fs";
import { mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

vi.mock("node:os", async (importOriginal) => {
	const actual = await importOriginal<typeof import("node:os")>();
	return { ...actual, homedir: vi.fn(() => actual.homedir()) };
});

import { homedir } from "node:os";
import create from "./index.js";
import resolve from "../resolve/index.js";

const mockHomedir = vi.mocked(homedir);

let home: string;
let appData: string;
let project: string;

function stubAppData(folder: string) {
	vi.stubEnv("AIDEMD_HOME", path.join(folder, "aidemd"));
}

beforeEach(async () => {
	home = await mkdtemp(path.join(tmpdir(), "aide-create-home-"));
	appData = await mkdtemp(path.join(tmpdir(), "aide-create-appdata-"));
	project = await mkdtemp(path.join(tmpdir(), "aide-create-project-"));
	mockHomedir.mockReturnValue(home);
	stubAppData(appData);
});

afterEach(async () => {
	vi.unstubAllEnvs();
	await Promise.all([home, appData, project].map((folder) => rm(folder, { recursive: true, force: true })));
});

describe("create", () => {
	it("creates the runtime folder with its events, presence and ended folders and returns the resolved paths", async () => {
		const paths = await create({ projectRoot: project });

		expect(paths).toEqual(resolve({ projectRoot: project }));
		expect(path.dirname(paths.folder)).toBe(path.join(appData, "aidemd"));
		expect(paths.eventsFolder).toBe(path.join(paths.folder, "events"));
		expect(paths.presenceFolder).toBe(path.join(paths.folder, "presence"));
		expect(paths.endedFolder).toBe(path.join(paths.folder, "ended"));
		expect(existsSync(paths.eventsFolder)).toBe(true);
		expect(existsSync(paths.presenceFolder)).toBe(true);
		expect(existsSync(paths.endedFolder)).toBe(true);
	});

	it("is a no-op for presence and ended folders that exist and keeps files inside them", async () => {
		const first = await create({ projectRoot: project });
		const presence = path.join(first.presenceFolder, "claude.json");
		const ended = path.join(first.endedFolder, "session.json");
		await writeFile(presence, "{}");
		await writeFile(ended, "{}");

		await create({ projectRoot: project });

		expect(existsSync(presence)).toBe(true);
		expect(existsSync(ended)).toBe(true);
	});

	it("succeeds on a second call and keeps a file already inside events", async () => {
		const first = await create({ projectRoot: project });
		const kept = path.join(first.eventsFolder, "session.jsonl");
		await writeFile(kept, "{}\n");

		const second = await create({ projectRoot: project });

		expect(second).toEqual(first);
		expect(existsSync(kept)).toBe(true);
	});

	it("writes nothing under the project root and no observer file", async () => {
		const paths = await create({ projectRoot: project });
		await create({ projectRoot: project });

		expect(await readdir(project)).toEqual([]);
		expect(existsSync(path.join(paths.folder, "observer.json"))).toBe(false);
		expect(await readdir(paths.folder)).toEqual(["ended", "events", "presence"]);
	});

	it("throws and creates nothing when the runtime folder would land inside the project", async () => {
		stubAppData(path.join(project, "state"));

		await expect(create({ projectRoot: project })).rejects.toThrow(project);

		expect(await readdir(project)).toEqual([]);
	});
});
