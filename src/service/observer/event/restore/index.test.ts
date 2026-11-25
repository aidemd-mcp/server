import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
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
import create from "@/util/runtimePaths/create/index.js";
import archiveSession from "@/service/observer/event/archive/index.js";
import writeEndedMark from "@/service/observer/event/shared/writeEndedMark/index.js";
import restoreSession from "./index.js";

const mockHomedir = vi.mocked(homedir);

const NOW = Date.parse("2026-11-22T12:00:00.000Z");
const HOUR = 60 * 60 * 1000;
const SESSION_A = "20261122T090000000Z-aaaaaa";

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

async function writeSession(sessionId: string): Promise<string> {
	const { eventsFolder } = resolve({ projectRoot: project });
	await mkdir(eventsFolder, { recursive: true });
	const file = resolveEventLog({ projectRoot: project, sessionId });
	await writeFile(file, makeLine(sessionId, 2 * HOUR), "utf-8");
	return file;
}

beforeEach(async () => {
	vi.clearAllMocks();
	vi.useFakeTimers({ toFake: ["Date"] });
	vi.setSystemTime(NOW);
	home = await mkdtemp(path.join(tmpdir(), "aide-restore-home-"));
	appData = await mkdtemp(path.join(tmpdir(), "aide-restore-appdata-"));
	project = await mkdtemp(path.join(tmpdir(), "aide-restore-project-"));
	mockHomedir.mockReturnValue(home);
	vi.stubEnv("LOCALAPPDATA", appData);
	vi.stubEnv("XDG_STATE_HOME", appData);
});

afterEach(async () => {
	vi.useRealTimers();
	vi.unstubAllEnvs();
	await Promise.all([home, appData, project].map((folder) => rm(folder, { recursive: true, force: true })));
});

describe("restoreSession", () => {
	it("moves an archived log back, byte for byte, and returns the session", async () => {
		const file = await writeSession(SESSION_A);
		const before = await readFile(file, "utf-8");
		const { projectKey } = await create({ projectRoot: project });
		await writeEndedMark({
			projectKey,
			mark: { v: 1, sessionId: SESSION_A, endedAt: new Date(NOW).toISOString(), endedBy: "user" },
		});
		await archiveSession({ projectKey, sessionId: SESSION_A });

		const result = await restoreSession({ projectKey, sessionId: SESSION_A });

		expect(result.outcome).toBe("restored");
		if (result.outcome !== "restored") return;
		expect(result.session.sessionId).toBe(SESSION_A);
		expect(result.session.liveness).toMatchObject({ state: "ended", endedBy: "user" });
		expect(result.session.events).toHaveLength(1);
		expect(await readFile(file, "utf-8")).toBe(before);
		expect(existsSync(resolveArchivedLog({ projectKey, sessionId: SESSION_A }))).toBe(false);
	});

	it("reports a session that is not archived as not-found", async () => {
		await writeSession(SESSION_A);
		const { projectKey } = resolve({ projectRoot: project });

		expect(await restoreSession({ projectKey, sessionId: SESSION_A })).toEqual({ outcome: "not-found" });
	});

	it("refuses to overwrite a log with the same id in the events folder", async () => {
		const file = await writeSession(SESSION_A);
		const { projectKey } = resolve({ projectRoot: project });
		const archived = resolveArchivedLog({ projectKey, sessionId: SESSION_A });
		await mkdir(path.dirname(archived), { recursive: true });
		await writeFile(archived, "archived copy\n", "utf-8");

		expect(await restoreSession({ projectKey, sessionId: SESSION_A })).toEqual({ outcome: "exists" });
		expect(existsSync(archived)).toBe(true);
		expect(await readFile(file, "utf-8")).toBe(makeLine(SESSION_A, 2 * HOUR));
	});

	it("rejects an unsafe id as invalid-id", async () => {
		const { projectKey } = resolve({ projectRoot: project });

		expect((await restoreSession({ projectKey, sessionId: "../x" })).outcome).toBe("invalid-id");
	});
});
