import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

vi.mock("node:os", async (importOriginal) => {
	const actual = await importOriginal<typeof import("node:os")>();
	return { ...actual, homedir: vi.fn(() => actual.homedir()) };
});

import { homedir } from "node:os";
import resolve from "@/util/runtimePaths/resolve/index.js";
import resolveEventLog from "@/util/runtimePaths/resolveEventLog/index.js";
import resolveArchivedLog from "@/util/runtimePaths/resolveArchivedLog/index.js";
import deleteSession from "./index.js";

const mockHomedir = vi.mocked(homedir);

const SESSION_A = "20261122T090000000Z-aaaaaa";
const SESSION_B = "20261122T100000000Z-bbbbbb";

let home: string;
let appData: string;
let project: string;

async function writeAt(file: string): Promise<string> {
	await mkdir(path.dirname(file), { recursive: true });
	await writeFile(file, "{}\n", "utf-8");
	return file;
}

function keyOfProject(): string {
	return resolve({ projectRoot: project }).projectKey;
}

function archivedPath(sessionId: string): string {
	return resolveArchivedLog({ projectKey: keyOfProject(), sessionId });
}

beforeEach(async () => {
	home = await mkdtemp(path.join(tmpdir(), "aide-delete-home-"));
	appData = await mkdtemp(path.join(tmpdir(), "aide-delete-appdata-"));
	project = await mkdtemp(path.join(tmpdir(), "aide-delete-project-"));
	mockHomedir.mockReturnValue(home);
	vi.stubEnv("LOCALAPPDATA", appData);
	vi.stubEnv("XDG_STATE_HOME", appData);
});

afterEach(async () => {
	vi.unstubAllEnvs();
	await Promise.all([home, appData, project].map((folder) => rm(folder, { recursive: true, force: true })));
});

describe("deleteSession", () => {
	it("deletes an archived session's file and leaves every other file in place", async () => {
		const target = await writeAt(archivedPath(SESSION_A));
		const sibling = await writeAt(archivedPath(SESSION_B));
		const active = await writeAt(resolveEventLog({ projectRoot: project, sessionId: SESSION_A }));

		const result = await deleteSession({ projectKey: keyOfProject(), sessionId: SESSION_A });

		expect(result).toEqual({ outcome: "deleted" });
		expect(existsSync(target)).toBe(false);
		expect(existsSync(sibling)).toBe(true);
		expect(existsSync(active)).toBe(true);
	});

	it("never deletes a session that has not been archived", async () => {
		const active = await writeAt(resolveEventLog({ projectRoot: project, sessionId: SESSION_A }));

		const result = await deleteSession({ projectKey: keyOfProject(), sessionId: SESSION_A });

		expect(result).toEqual({ outcome: "not-found" });
		expect(existsSync(active)).toBe(true);
	});

	it.each([
		["key", "../x", SESSION_A],
		["id", undefined, "../x"],
	])("rejects an unsafe %s as invalid-id and touches nothing", async (_label, unsafeKey, sessionId) => {
		await writeAt(archivedPath(SESSION_A));
		const before = (await readdir(appData, { recursive: true })).sort();

		const result = await deleteSession({ projectKey: unsafeKey ?? keyOfProject(), sessionId });

		expect(result.outcome).toBe("invalid-id");
		expect((await readdir(appData, { recursive: true })).sort()).toEqual(before);
	});
});
