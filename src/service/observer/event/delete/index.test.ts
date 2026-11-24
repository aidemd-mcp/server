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
import deleteSession from "./index.js";

const mockHomedir = vi.mocked(homedir);
const mockIsProcessRunning = isProcessRunning as ReturnType<typeof vi.fn>;

const NOW = Date.parse("2026-11-22T12:00:00.000Z");
const HOUR = 60 * 60 * 1000;
const SESSION_A = "20261122T090000000Z-aaaaaa";
const SESSION_B = "20261122T100000000Z-bbbbbb";

let home: string;
let appData: string;
let project: string;

function stubAppData(folder: string) {
	vi.stubEnv("LOCALAPPDATA", folder);
	vi.stubEnv("XDG_STATE_HOME", folder);
}

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

async function snapshot(folder: string): Promise<string[]> {
	return (await readdir(folder, { recursive: true })).sort();
}

beforeEach(async () => {
	vi.clearAllMocks();
	mockIsProcessRunning.mockReturnValue(false);
	vi.useFakeTimers({ toFake: ["Date"] });
	vi.setSystemTime(NOW);
	home = await mkdtemp(path.join(tmpdir(), "aide-delete-home-"));
	appData = await mkdtemp(path.join(tmpdir(), "aide-delete-appdata-"));
	project = await mkdtemp(path.join(tmpdir(), "aide-delete-project-"));
	mockHomedir.mockReturnValue(home);
	stubAppData(appData);
});

afterEach(async () => {
	vi.useRealTimers();
	vi.unstubAllEnvs();
	await Promise.all([home, appData, project].map((folder) => rm(folder, { recursive: true, force: true })));
});

describe("deleteSession", () => {
	it("deletes an idle session's file and leaves everything else in place", async () => {
		const target = await writeSession(SESSION_A, 2 * HOUR);
		const other = await writeSession(SESSION_B, 2 * HOUR);
		const { folder, eventsFolder } = resolve({ projectRoot: project });
		const sentinel = path.join(folder, "sentinel.json");
		await writeFile(sentinel, "{}", "utf-8");

		const result = await deleteSession({ projectKey: keyOfProject(), sessionId: SESSION_A });

		expect(result).toEqual({ outcome: "deleted" });
		expect(existsSync(target)).toBe(false);
		expect(existsSync(other)).toBe(true);
		expect(existsSync(sentinel)).toBe(true);
		expect(existsSync(eventsFolder)).toBe(true);
	});

	it("refuses a session that is live by a recent event and leaves its file untouched", async () => {
		const target = await writeSession(SESSION_A, 60 * 1000);
		const before = await readFile(target, "utf-8");

		const result = await deleteSession({ projectKey: keyOfProject(), sessionId: SESSION_A });

		expect(result).toEqual({ outcome: "live" });
		expect(await readFile(target, "utf-8")).toBe(before);
	});

	it("refuses a session that is live by its pid alone", async () => {
		mockIsProcessRunning.mockReturnValue(true);
		const target = await writeSession(SESSION_A, 2 * HOUR);

		const result = await deleteSession({ projectKey: keyOfProject(), sessionId: SESSION_A });

		expect(result).toEqual({ outcome: "live" });
		expect(existsSync(target)).toBe(true);
	});

	it("refuses a session whose log cannot be read and deletes nothing", async () => {
		const other = await writeSession(SESSION_B, 2 * HOUR);
		const { folder, eventsFolder } = resolve({ projectRoot: project });
		const sentinel = path.join(folder, "sentinel.json");
		await writeFile(sentinel, "{}", "utf-8");
		// A directory in the file's place: reading it fails with EISDIR on every OS.
		const target = resolveEventLog({ projectRoot: project, sessionId: SESSION_A });
		await mkdir(target);

		const result = await deleteSession({ projectKey: keyOfProject(), sessionId: SESSION_A });

		expect(result).toEqual({ outcome: "unreadable" });
		expect(existsSync(target)).toBe(true);
		expect(existsSync(other)).toBe(true);
		expect(existsSync(sentinel)).toBe(true);
		expect(existsSync(eventsFolder)).toBe(true);
	});

	it("reports an unknown id as not-found", async () => {
		await writeSession(SESSION_B, 2 * HOUR);

		const result = await deleteSession({ projectKey: keyOfProject(), sessionId: SESSION_A });

		expect(result).toEqual({ outcome: "not-found" });
	});

	it.each(["..", "../observer", "a/b", "a\\b", ".hidden", ""])(
		"rejects the unsafe id %j and changes nothing",
		async (sessionId) => {
			await writeSession(SESSION_A, 2 * HOUR);
			const { folder } = resolve({ projectRoot: project });
			const before = await snapshot(folder);

			const result = await deleteSession({ projectKey: keyOfProject(), sessionId });

			expect(result.outcome).toBe("invalid-id");
			expect(await snapshot(folder)).toEqual(before);
		},
	);

	it("leaves the project folder byte-identical", async () => {
		const sentinel = path.join(project, "sentinel.txt");
		await writeFile(sentinel, "keep me", "utf-8");
		await writeSession(SESSION_A, 2 * HOUR);

		await deleteSession({ projectKey: keyOfProject(), sessionId: SESSION_A });

		expect(await readdir(project)).toEqual(["sentinel.txt"]);
		expect(await readFile(sentinel, "utf-8")).toBe("keep me");
	});
});

describe("deleteSession by project key", () => {
	async function writeKeyedSession(projectRoot: string, sessionId: string, ageMs: number): Promise<string> {
		const { eventsFolder } = resolve({ projectRoot });
		await mkdir(eventsFolder, { recursive: true });
		const file = resolveEventLog({ projectRoot, sessionId });
		await writeFile(file, makeLine(sessionId, ageMs), "utf-8");
		return file;
	}

	it("deletes only the chosen past session in project A and leaves a same-named session in project B", async () => {
		const otherProject = await mkdtemp(path.join(tmpdir(), "aide-delete-other-"));
		try {
			const target = await writeKeyedSession(project, SESSION_A, 2 * HOUR);
			const sibling = await writeKeyedSession(project, SESSION_B, 2 * HOUR);
			const sameNamed = await writeKeyedSession(otherProject, SESSION_A, 2 * HOUR);

			const result = await deleteSession({ projectKey: resolve({ projectRoot: project }).projectKey, sessionId: SESSION_A });

			expect(result).toEqual({ outcome: "deleted" });
			expect(existsSync(target)).toBe(false);
			expect(existsSync(sibling)).toBe(true);
			expect(existsSync(sameNamed)).toBe(true);
		} finally {
			await rm(otherProject, { recursive: true, force: true });
		}
	});

	it("refuses a live session and leaves its file", async () => {
		const target = await writeKeyedSession(project, SESSION_A, 60 * 1000);

		const result = await deleteSession({ projectKey: resolve({ projectRoot: project }).projectKey, sessionId: SESSION_A });

		expect(result).toEqual({ outcome: "live" });
		expect(existsSync(target)).toBe(true);
	});

	it("refuses an unreadable session and leaves it", async () => {
		const { eventsFolder, projectKey } = resolve({ projectRoot: project });
		await mkdir(eventsFolder, { recursive: true });
		// A directory in the file's place: reading it fails with EISDIR on every OS.
		const target = resolveEventLog({ projectRoot: project, sessionId: SESSION_A });
		await mkdir(target);

		const result = await deleteSession({ projectKey, sessionId: SESSION_A });

		expect(result).toEqual({ outcome: "unreadable" });
		expect(existsSync(target)).toBe(true);
	});

	it.each([
		["key", "../x", SESSION_A],
		["id", undefined, "../x"],
	])("rejects an unsafe %s as invalid-id and touches nothing", async (_label, unsafeKey, sessionId) => {
		await writeKeyedSession(project, SESSION_A, 2 * HOUR);
		const before = await snapshot(appData);
		const projectKey = unsafeKey ?? resolve({ projectRoot: project }).projectKey;

		const result = await deleteSession({ projectKey, sessionId });

		expect(result.outcome).toBe("invalid-id");
		expect(await snapshot(appData)).toEqual(before);
	});

	it("reports a missing session as not-found", async () => {
		await writeKeyedSession(project, SESSION_B, 2 * HOUR);

		const result = await deleteSession({ projectKey: resolve({ projectRoot: project }).projectKey, sessionId: SESSION_A });

		expect(result).toEqual({ outcome: "not-found" });
	});
});
