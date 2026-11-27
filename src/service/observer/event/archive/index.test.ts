import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
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
import resolvePresenceFile from "@/util/runtimePaths/resolvePresenceFile/index.js";
import create from "@/util/runtimePaths/create/index.js";
import writeEndedMark from "@/service/observer/event/shared/writeEndedMark/index.js";
import archiveSession from "./index.js";

const mockHomedir = vi.mocked(homedir);

const NOW = Date.parse("2026-11-22T12:00:00.000Z");
const HOUR = 60 * 60 * 1000;
const SESSION_A = "20261122T090000000Z-aaaaaa";
const SESSION_B = "20261122T100000000Z-bbbbbb";

let home: string;
let appData: string;
let project: string;

function makeLine(sessionId: string, ageMs: number, v: 1 | 2 = 1): string {
	return (
		JSON.stringify({
			v,
			ts: new Date(NOW - ageMs).toISOString(),
			sessionId,
			seq: 1,
			pid: 4242,
			kind: "release",
			version: "1.0.0",
		}) + "\n"
	);
}

async function writeSession(sessionId: string, ageMs: number, v: 1 | 2 = 1): Promise<string> {
	const { eventsFolder } = resolve({ projectRoot: project });
	await mkdir(eventsFolder, { recursive: true });
	const file = resolveEventLog({ projectRoot: project, sessionId });
	await writeFile(file, makeLine(sessionId, ageMs, v), "utf-8");
	return file;
}

/** Ends the session the way the user does: an exclusive ended mark under its id. */
async function endSession(sessionId: string): Promise<void> {
	await create({ projectRoot: project });
	await writeEndedMark({
		projectKey: keyOfProject(),
		mark: { v: 1, sessionId, endedAt: new Date(NOW).toISOString(), endedBy: "user" },
	});
}

/** A Stop or SessionEnd hook record linked to the session. */
async function writePresence(sessionId: string, claudeSessionId: string, state: "waiting" | "ended"): Promise<void> {
	await create({ projectRoot: project });
	await writeFile(
		resolvePresenceFile({ projectKey: keyOfProject(), claudeSessionId }),
		JSON.stringify({
			v: 1,
			claudeSessionId,
			sessionId,
			state,
			at: new Date(NOW - 60 * 1000).toISOString(),
			hookEvent: state === "ended" ? "SessionEnd" : "Stop",
		}),
		"utf-8",
	);
}

function keyOfProject(): string {
	return resolve({ projectRoot: project }).projectKey;
}

beforeEach(async () => {
	vi.clearAllMocks();
	vi.useFakeTimers({ toFake: ["Date"] });
	vi.setSystemTime(NOW);
	home = await mkdtemp(path.join(tmpdir(), "aide-archive-home-"));
	appData = await mkdtemp(path.join(tmpdir(), "aide-archive-appdata-"));
	project = await mkdtemp(path.join(tmpdir(), "aide-archive-project-"));
	mockHomedir.mockReturnValue(home);
	vi.stubEnv("AIDEMD_HOME", path.join(appData, "aidemd"));
});

afterEach(async () => {
	vi.useRealTimers();
	vi.unstubAllEnvs();
	await Promise.all([home, appData, project].map((folder) => rm(folder, { recursive: true, force: true })));
});

describe("archiveSession", () => {
	it("moves an ended session's log into the project's archive folder and leaves the others", async () => {
		const target = await writeSession(SESSION_A, 2 * HOUR);
		const other = await writeSession(SESSION_B, 2 * HOUR);
		await endSession(SESSION_A);
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

	it("accepts a session whose SessionEnd presence says ended", async () => {
		const target = await writeSession(SESSION_A, 2 * HOUR);
		await writePresence(SESSION_A, SESSION_B, "ended");

		expect(await archiveSession({ projectKey: keyOfProject(), sessionId: SESSION_A })).toEqual({ outcome: "archived" });
		expect(existsSync(target)).toBe(false);
	});

	it.each([
		["v1 recent", 1, 60 * 1000],
		["v1 quiet for hours", 1, 2 * HOUR],
		["v2 recent", 2, 60 * 1000],
		["v2 quiet for hours", 2, 2 * HOUR],
	] as const)("refuses a hookless %s session as live and leaves it in place", async (_label, v, ageMs) => {
		const target = await writeSession(SESSION_A, ageMs, v);

		const result = await archiveSession({ projectKey: keyOfProject(), sessionId: SESSION_A });

		expect(result).toEqual({ outcome: "live" });
		expect(existsSync(target)).toBe(true);
		expect(existsSync(resolveArchivedLog({ projectKey: keyOfProject(), sessionId: SESSION_A }))).toBe(false);
	});

	it("refuses a session that only waits for the user (Stop presence), which is not ended", async () => {
		const target = await writeSession(SESSION_A, 2 * HOUR);
		await writePresence(SESSION_A, SESSION_B, "waiting");

		expect(await archiveSession({ projectKey: keyOfProject(), sessionId: SESSION_A })).toEqual({ outcome: "live" });
		expect(existsSync(target)).toBe(true);
	});

	it("refuses an earlier session of a conversation whose newest session is still working", async () => {
		const target = await writeSession(SESSION_A, 2 * HOUR);
		await writeSession(SESSION_B, 60 * 1000);
		await create({ projectRoot: project });
		await writeFile(
			resolvePresenceFile({ projectKey: keyOfProject(), claudeSessionId: "claude-resumed" }),
			JSON.stringify({
				v: 1,
				claudeSessionId: "claude-resumed",
				sessionId: SESSION_B,
				earlierSessionIds: [SESSION_A],
				state: "working",
				at: new Date(NOW - 60 * 1000).toISOString(),
				hookEvent: "PostToolUse",
			}),
			"utf-8",
		);

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
