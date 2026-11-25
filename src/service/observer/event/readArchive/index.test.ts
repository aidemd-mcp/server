import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdir, mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

vi.mock("@/util/isProcessRunning/index.js", () => ({
	default: vi.fn(() => false),
}));

import resolveArchivedLog from "@/util/runtimePaths/resolveArchivedLog/index.js";
import readArchive from "./index.js";

const KEY = "alpha-3f9a2c";
const SESSION_A = "20261122T090000000Z-aaaaaa";
const SESSION_B = "20261122T100000000Z-bbbbbb";

let appData: string;

function makeLine(sessionId: string): string {
	return (
		JSON.stringify({
			v: 1,
			ts: "2026-11-22T08:00:00.000Z",
			sessionId,
			seq: 1,
			pid: 4242,
			kind: "release",
			version: "1.0.0",
		}) + "\n"
	);
}

async function archive(sessionId: string): Promise<void> {
	const file = resolveArchivedLog({ projectKey: KEY, sessionId });
	await mkdir(path.dirname(file), { recursive: true });
	await writeFile(file, makeLine(sessionId), "utf-8");
}

beforeEach(async () => {
	appData = await mkdtemp(path.join(tmpdir(), "aide-read-archive-"));
	vi.stubEnv("LOCALAPPDATA", appData);
	vi.stubEnv("XDG_STATE_HOME", appData);
});

afterEach(async () => {
	vi.unstubAllEnvs();
	await rm(appData, { recursive: true, force: true });
});

describe("readArchive", () => {
	it("lists the project's archived sessions oldest first, never live", async () => {
		await archive(SESSION_B);
		await archive(SESSION_A);

		const sessions = await readArchive({ projectKey: KEY });

		expect(sessions.map((session) => session.sessionId)).toEqual([SESSION_A, SESSION_B]);
		expect(sessions.every((session) => !session.unreadable)).toBe(true);
	});

	it("skips files that are not safe session logs", async () => {
		await archive(SESSION_A);
		const folder = path.dirname(resolveArchivedLog({ projectKey: KEY, sessionId: SESSION_A }));
		await writeFile(path.join(folder, ".hidden.jsonl"), "x", "utf-8");
		await writeFile(path.join(folder, "notes.txt"), "x", "utf-8");

		expect((await readArchive({ projectKey: KEY })).map((session) => session.sessionId)).toEqual([SESSION_A]);
	});

	it("answers [] for a project with no archive and for an unsafe key, creating nothing", async () => {
		expect(await readArchive({ projectKey: KEY })).toEqual([]);
		expect(await readArchive({ projectKey: "../x" })).toEqual([]);
		expect(await readdir(appData)).toEqual([]);
	});
});
