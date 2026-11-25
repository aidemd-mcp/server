import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

vi.mock("node:os", async (importOriginal) => {
	const actual = await importOriginal<typeof import("node:os")>();
	return { ...actual, homedir: vi.fn(() => actual.homedir()) };
});

import { homedir } from "node:os";
import resolvePresenceFile from "@/util/runtimePaths/resolvePresenceFile/index.js";
import readProject from "./index.js";

const mockHomedir = vi.mocked(homedir);

const KEY = "demo-abcdef";
const FIRST = "20261122T090000000Z-aaaaaa";
const SECOND = "20261122T100000000Z-bbbbbb";
const NOW = Date.parse("2026-11-22T12:00:00.000Z");
const HOUR = 60 * 60 * 1000;

let home: string;
let appData: string;
let eventsFolder: string;

function makeEvent(sessionId: string, overrides: Record<string, unknown> = {}): Record<string, unknown> {
	return {
		v: 1,
		ts: new Date(NOW - 60 * 1000).toISOString(),
		sessionId,
		seq: 1,
		pid: 4242,
		kind: "release",
		version: "1.0.0",
		...overrides,
	};
}

function makeStart(sessionId: string, overrides: Record<string, unknown> = {}): Record<string, unknown> {
	return makeEvent(sessionId, { kind: "session_started", version: undefined, ...overrides });
}

function toLines(events: unknown[]): string {
	return events.map((event) => JSON.stringify(event)).join("\n") + "\n";
}

async function writeSession(sessionId: string, content: string): Promise<void> {
	await mkdir(eventsFolder, { recursive: true });
	await writeFile(path.join(eventsFolder, `${sessionId}.jsonl`), content, "utf-8");
}

/** A hook presence record under the project's presence folder, optionally linked to a session. */
async function writePresence(claudeSessionId: string, sessionId: string | undefined, state: "waiting" | "ended"): Promise<void> {
	const file = resolvePresenceFile({ projectKey: KEY, claudeSessionId });
	await mkdir(path.dirname(file), { recursive: true });
	await writeFile(
		file,
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

beforeEach(async () => {
	vi.clearAllMocks();
	vi.useFakeTimers({ toFake: ["Date"] });
	vi.setSystemTime(NOW);
	home = await mkdtemp(path.join(tmpdir(), "aide-readproject-home-"));
	appData = await mkdtemp(path.join(tmpdir(), "aide-readproject-appdata-"));
	mockHomedir.mockReturnValue(home);
	vi.stubEnv("AIDEMD_HOME", path.join(appData, "aidemd"));
	eventsFolder = path.join(appData, "aidemd", KEY, "events");
});

afterEach(async () => {
	vi.useRealTimers();
	vi.unstubAllEnvs();
	await Promise.all([home, appData].map((folder) => rm(folder, { recursive: true, force: true })));
});

describe("readProject", () => {
	it("returns null when the events folder does not exist", async () => {
		expect(await readProject({ projectKey: KEY, eventsFolder })).toBeNull();
	});

	it("returns null when the events folder holds no session", async () => {
		await mkdir(eventsFolder, { recursive: true });

		expect(await readProject({ projectKey: KEY, eventsFolder })).toBeNull();
	});

	it("returns the sessions oldest first with the root the newest session reported", async () => {
		await writeSession(SECOND, toLines([makeStart(SECOND, { projectRoot: "D:/new" })]));
		await writeSession(
			FIRST,
			toLines([makeStart(FIRST, { projectRoot: "D:/old", ts: new Date(NOW - 3 * HOUR).toISOString() })]),
		);

		const project = await readProject({ projectKey: KEY, eventsFolder });

		expect(project?.projectKey).toBe(KEY);
		expect(project?.projectRoot).toBe("D:/new");
		expect(project?.sessions.map((session) => session.sessionId)).toEqual([FIRST, SECOND]);
	});

	it("has a null root when no session reported one, and still lists every session", async () => {
		await writeSession(FIRST, toLines([makeEvent(FIRST)]));
		await writeSession(SECOND, toLines([makeStart(SECOND)]));

		const project = await readProject({ projectKey: KEY, eventsFolder });

		expect(project?.projectRoot).toBeNull();
		expect(project?.sessions).toHaveLength(2);
	});

	it("gives every session its liveness: a hookless session works, a Stop presence shows it waiting", async () => {
		await writeSession(FIRST, toLines([makeEvent(FIRST)]));
		await writeSession(SECOND, toLines([makeEvent(SECOND, { v: 2 })]));
		await writePresence("c1111111", FIRST, "waiting");

		const project = await readProject({ projectKey: KEY, eventsFolder });

		expect(project?.sessions.map((session) => session.liveness.state)).toEqual(["waiting", "working"]);
		expect(project?.unlinked).toEqual([]);
	});

	it("carries a presence linked to no session as unlinked, ended ones included", async () => {
		await writeSession(FIRST, toLines([makeEvent(FIRST)]));
		await writePresence("c2222222", undefined, "ended");

		const project = await readProject({ projectKey: KEY, eventsFolder });

		expect(project?.unlinked).toHaveLength(1);
		expect(project?.unlinked[0]).toMatchObject({ claudeSessionId: "c2222222", liveness: { state: "ended", endedBy: "hook" } });
	});

	it("ignores non-session files and a folder named like a log", async () => {
		await writeSession(FIRST, toLines([makeEvent(FIRST)]));
		await writeFile(path.join(eventsFolder, "notes.txt"), "hello", "utf-8");
		await writeFile(path.join(eventsFolder, ".hidden.jsonl"), toLines([makeEvent(".hidden")]), "utf-8");
		await mkdir(path.join(eventsFolder, "x.jsonl"));

		const project = await readProject({ projectKey: KEY, eventsFolder });

		expect(project?.sessions.map((session) => session.sessionId)).toEqual([FIRST]);
	});
});
