import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

vi.mock("node:os", async (importOriginal) => {
	const actual = await importOriginal<typeof import("node:os")>();
	return { ...actual, homedir: vi.fn(() => actual.homedir()) };
});

vi.mock("@/util/isProcessRunning/index.js", () => ({
	default: vi.fn(),
}));

import { homedir } from "node:os";
import isProcessRunning from "@/util/isProcessRunning/index.js";
import resolve from "@/util/runtimePaths/resolve/index.js";
import resolveEventLog from "@/util/runtimePaths/resolveEventLog/index.js";
import resolveArchivedLog from "@/util/runtimePaths/resolveArchivedLog/index.js";
import archiveSession from "./index.js";

const mockHomedir = vi.mocked(homedir);
const mockIsProcessRunning = isProcessRunning as ReturnType<typeof vi.fn>;

const NOW = Date.parse("2026-11-22T12:00:00.000Z");
const HOUR = 60 * 60 * 1000;
const SESSION_A = "20261122T090000000Z-aaaaaa";
const SESSION_B = "20261122T100000000Z-bbbbbb";

let home: string;
let appData: string;
let project: string;

function makeLine(sessionId: string, ageMs: number): string {
	return (
		JSON.stringify({
			v: 1,
			ts: new Date(NOW - ageMs).toISOString(),
			sessionId,
			seq: 1,
			pid: 4242,
			kind: "release",
			version: "1.0.0",
		}) + "\n"
	);
}

async function writeSession(sessionId: string, ageMs: number): Promise<string> {
	const { eventsFolder } = resolve({ projectRoot: project });
	await mkdir(eventsFolder, { recursive: true });
	const file = resolveEventLog({ projectRoot: project, sessionId });
	await writeFile(file, makeLine(sessionId, ageMs), "utf-8");
	return file;
}

function keyOfProject(): string {
	return resolve({ projectRoot: project }).projectKey;
}

beforeEach(async () => {
	vi.clearAllMocks();
	mockIsProcessRunning.mockReturnValue(false);
	vi.useFakeTimers({ toFake: ["Date"] });
	vi.setSystemTime(NOW);
	home = await mkdtemp(path.join(tmpdir(), "aide-archive-home-"));
	appData = await mkdtemp(path.join(tmpdir(), "aide-archive-appdata-"));
	project = await mkdtemp(path.join(tmpdir(), "aide-archive-project-"));
	mockHomedir.mockReturnValue(home);
	vi.stubEnv("LOCALAPPDATA", appData);
	vi.stubEnv("XDG_STATE_HOME", appData);
});

afterEach(async () => {
	vi.useRealTimers();
	vi.unstubAllEnvs();
	await Promise.all([home, appData, project].map((folder) => rm(folder, { recursive: true, force: true })));
});

describe("archiveSession", () => {
	it("moves a past session's log into the project's archive folder and leaves the others", async () => {
		const target = await writeSession(SESSION_A, 2 * HOUR);
		const other = await writeSession(SESSION_B, 2 * HOUR);
		const before = await readFile(target, "utf-8");

		const result = await archiveSession({ projectKey: keyOfProject(), sessionId: SESSION_A });

		const archived = resolveArchivedLog({ projectKey: keyOfProject(), sessionId: SESSION_A });
		expect(result).toEqual({ outcome: "archived" });
		expect(existsSync(target)).toBe(false);
		expect(await readFile(archived, "utf-8")).toBe(before);
		expect(existsSync(other)).toBe(true);
		expect(path.basename(path.dirname(archived))).toBe("archive");
		expect(path.dirname(path.dirname(archived))).toBe(path.dirname(path.dirname(other)));
	});

	it("refuses a session that is live by a recent event and leaves it in place", async () => {
		const target = await writeSession(SESSION_A, 60 * 1000);

		const result = await archiveSession({ projectKey: keyOfProject(), sessionId: SESSION_A });

		expect(result).toEqual({ outcome: "live" });
		expect(existsSync(target)).toBe(true);
		expect(existsSync(resolveArchivedLog({ projectKey: keyOfProject(), sessionId: SESSION_A }))).toBe(false);
	});

	it("refuses a session that is live by its pid alone", async () => {
		mockIsProcessRunning.mockReturnValue(true);
		const target = await writeSession(SESSION_A, 2 * HOUR);

		expect(await archiveSession({ projectKey: keyOfProject(), sessionId: SESSION_A })).toEqual({ outcome: "live" });
		expect(existsSync(target)).toBe(true);
	});

	it("refuses an unreadable log and moves nothing", async () => {
		const { eventsFolder } = resolve({ projectRoot: project });
		await mkdir(eventsFolder, { recursive: true });
		// A directory in the file's place: reading it fails with EISDIR on every OS.
		const target = resolveEventLog({ projectRoot: project, sessionId: SESSION_A });
		await mkdir(target);

		expect(await archiveSession({ projectKey: keyOfProject(), sessionId: SESSION_A })).toEqual({ outcome: "unreadable" });
		expect(existsSync(target)).toBe(true);
		expect(existsSync(resolveArchivedLog({ projectKey: keyOfProject(), sessionId: SESSION_A }))).toBe(false);
	});

	it("reports an unknown id as not-found and creates no archive folder", async () => {
		await writeSession(SESSION_B, 2 * HOUR);

		expect(await archiveSession({ projectKey: keyOfProject(), sessionId: SESSION_A })).toEqual({ outcome: "not-found" });
		expect(await readdir(resolve({ projectRoot: project }).folder)).toEqual(["events"]);
	});

	it.each([
		["key", "../x", SESSION_A],
		["id", undefined, "../x"],
	])("rejects an unsafe %s as invalid-id and touches nothing", async (_label, unsafeKey, sessionId) => {
		await writeSession(SESSION_A, 2 * HOUR);
		const before = (await readdir(appData, { recursive: true })).sort();

		const result = await archiveSession({ projectKey: unsafeKey ?? keyOfProject(), sessionId });

		expect(result.outcome).toBe("invalid-id");
		expect((await readdir(appData, { recursive: true })).sort()).toEqual(before);
	});
});
