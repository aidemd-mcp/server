import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdtemp, mkdir, readdir, rm, writeFile, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

vi.mock("node:os", async (importOriginal) => {
	const actual = await importOriginal<typeof import("node:os")>();
	return { ...actual, homedir: vi.fn(() => actual.homedir()) };
});

import { homedir } from "node:os";
import read from "./index.js";
import resolve from "@/util/runtimePaths/resolve/index.js";
import resolveEventLog from "@/util/runtimePaths/resolveEventLog/index.js";
import resolvePresenceFile from "@/util/runtimePaths/resolvePresenceFile/index.js";

const mockHomedir = vi.mocked(homedir);

const FIRST = "20261122T090000000Z-aaaaaa";
const SECOND = "20261122T100000000Z-bbbbbb";
const NOW = Date.parse("2026-11-22T12:00:00.000Z");
const HOUR = 60 * 60 * 1000;

let home: string;
let appData: string;
let project: string;

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

function toLines(events: unknown[]): string {
	return events.map((event) => JSON.stringify(event)).join("\n") + "\n";
}

async function writeSession(sessionId: string, content: string): Promise<void> {
	const file = resolveEventLog({ projectRoot: project, sessionId });
	await mkdir(path.dirname(file), { recursive: true });
	await writeFile(file, content, "utf-8");
}

/** Every session recorded for the test project, oldest first, read by its project key. */
async function readSessions() {
	const projects = await read({ projectKey: resolve({ projectRoot: project }).projectKey });
	return projects.flatMap((entry) => entry.sessions);
}

beforeEach(async () => {
	vi.clearAllMocks();
	vi.useFakeTimers({ toFake: ["Date"] });
	vi.setSystemTime(NOW);
	home = await mkdtemp(path.join(tmpdir(), "aide-read-home-"));
	appData = await mkdtemp(path.join(tmpdir(), "aide-read-appdata-"));
	project = await mkdtemp(path.join(tmpdir(), "aide-read-project-"));
	mockHomedir.mockReturnValue(home);
	vi.stubEnv("AIDEMD_HOME", path.join(appData, "aidemd"));
});

afterEach(async () => {
	vi.useRealTimers();
	vi.unstubAllEnvs();
	await Promise.all([home, appData, project].map((folder) => rm(folder, { recursive: true, force: true })));
});

describe("read", () => {
	it("returns an empty list and creates nothing when no events folder exists", async () => {
		const result = await readSessions();

		expect(result).toEqual([]);
		const paths = resolve({ projectRoot: project });
		await expect(stat(paths.folder)).rejects.toMatchObject({ code: "ENOENT" });
	});

	it("returns sessions oldest first with events in seq order and the full prompt text", async () => {
		const prompt = "line one\nline \"two\"\n" + "x".repeat(5000);
		await writeSession(
			SECOND,
			toLines([makeEvent(SECOND, { seq: 2, kind: "prompt", version: undefined, text: prompt }), makeEvent(SECOND, { seq: 1 })]),
		);
		await writeSession(FIRST, toLines([makeEvent(FIRST, { seq: 1 })]));

		const result = await readSessions();

		expect(result.map((log) => log.sessionId)).toEqual([FIRST, SECOND]);
		expect(result[1].events.map((event) => event.seq)).toEqual([1, 2]);
		const promptEvent = result[1].events[1];
		expect(promptEvent.kind === "prompt" && promptEvent.text).toBe(prompt);
	});

	it("returns the other events of a session with a malformed line and still returns the next session whole", async () => {
		const broken = `${JSON.stringify(makeEvent(FIRST, { seq: 1 }))}\n{not json\n${JSON.stringify(makeEvent(FIRST, { seq: 2 }))}\n`;
		await writeSession(FIRST, broken);
		await writeSession(SECOND, toLines([makeEvent(SECOND, { seq: 1 }), makeEvent(SECOND, { seq: 2 })]));

		const result = await readSessions();

		expect(result).toHaveLength(2);
		expect(result[0].events).toHaveLength(2);
		expect(result[0].skippedLines).toBe(1);
		expect(result[1].events).toHaveLength(2);
		expect(result[1].skippedLines).toBe(0);
	});

	it("has started null for a session with no session_started", async () => {
		await writeSession(FIRST, toLines([makeEvent(FIRST, { seq: 1 })]));

		const [log] = await readSessions();

		expect(log.started).toBeNull();
	});

	it("holds exactly the reported fields in started", async () => {
		const started = makeEvent(FIRST, { seq: 1, kind: "session_started", version: undefined, brainPath: "D:/brain" });
		await writeSession(FIRST, toLines([started]));

		const [log] = await readSessions();

		expect(log.started).toEqual(JSON.parse(JSON.stringify(started)));
		expect(log.started).not.toHaveProperty("kanbanTag");
	});

	it("ignores non-session files, a folder named like a log and a hidden file", async () => {
		await writeSession(FIRST, toLines([makeEvent(FIRST, { seq: 1 })]));
		const eventsFolder = resolve({ projectRoot: project }).eventsFolder;
		await writeFile(path.join(eventsFolder, "notes.txt"), "hello", "utf-8");
		await mkdir(path.join(eventsFolder, "x.jsonl"));
		await writeFile(path.join(eventsFolder, ".hidden.jsonl"), toLines([makeEvent(".hidden")]), "utf-8");

		const result = await readSessions();

		expect(result.map((log) => log.sessionId)).toEqual([FIRST]);
	});

	it("judges liveness per session by the one rule: no presence works however old, a Stop presence waits", async () => {
		const old = new Date(NOW - 2 * HOUR).toISOString();
		await writeSession(FIRST, toLines([makeEvent(FIRST, { seq: 1, ts: old })]));
		await writeSession(SECOND, toLines([makeEvent(SECOND, { seq: 1, ts: old })]));
		const projectKey = resolve({ projectRoot: project }).projectKey;
		const presence = resolvePresenceFile({ projectKey, claudeSessionId: "c3333333" });
		await mkdir(path.dirname(presence), { recursive: true });
		await writeFile(
			presence,
			JSON.stringify({
				v: 1,
				claudeSessionId: "c3333333",
				sessionId: SECOND,
				state: "waiting",
				at: new Date(NOW - 60 * 1000).toISOString(),
				hookEvent: "Stop",
			}),
			"utf-8",
		);

		const result = await readSessions();

		expect(result.map((log) => log.liveness.state)).toEqual(["working", "waiting"]);
		expect(result[0]!.liveness.maybeStuck).toBe(true);
		expect(result[1]!.liveness.maybeStuck).toBe(false);
	});

	it("leaves the project folder empty", async () => {
		await writeSession(FIRST, toLines([makeEvent(FIRST, { seq: 1 })]));

		await readSessions();

		expect(await readdir(project)).toEqual([]);
	});
});

describe("read (project listing)", () => {
	const KEY_A = "alpha-abcdef";
	const KEY_B = "beta-123456";

	async function writeProjectSession(projectKey: string, sessionId: string, content: string): Promise<void> {
		const folder = path.join(appData, "aidemd", projectKey, "events");
		await mkdir(folder, { recursive: true });
		await writeFile(path.join(folder, `${sessionId}.jsonl`), content, "utf-8");
	}

	function makeStart(sessionId: string, overrides: Record<string, unknown> = {}): Record<string, unknown> {
		return makeEvent(sessionId, { kind: "session_started", version: undefined, ...overrides });
	}

	it("lists nothing and creates nothing when the app-data root does not exist", async () => {
		expect(await read()).toEqual([]);
		await expect(stat(path.join(appData, "aidemd"))).rejects.toMatchObject({ code: "ENOENT" });
	});

	it("lists two projects in key order with their sessions oldest first", async () => {
		await writeProjectSession(KEY_B, FIRST, toLines([makeEvent(FIRST)]));
		await writeProjectSession(KEY_A, SECOND, toLines([makeEvent(SECOND)]));
		await writeProjectSession(KEY_A, FIRST, toLines([makeEvent(FIRST)]));

		const result = await read();

		expect(result.map((entry) => entry.projectKey)).toEqual([KEY_A, KEY_B]);
		expect(result[0].sessions.map((log) => log.sessionId)).toEqual([FIRST, SECOND]);
		expect(result[1].sessions.map((log) => log.sessionId)).toEqual([FIRST]);
	});

	it("treats an empty input object like no input", async () => {
		await writeProjectSession(KEY_A, FIRST, toLines([makeEvent(FIRST)]));

		expect((await read({})).map((entry) => entry.projectKey)).toEqual([KEY_A]);
	});

	it("lists a project whose sessions never reported a root, with projectRoot null and all its sessions", async () => {
		await writeProjectSession(KEY_A, FIRST, toLines([makeEvent(FIRST)]));
		await writeProjectSession(KEY_A, SECOND, toLines([makeStart(SECOND)]));

		const [entry] = await read();

		expect(entry.projectKey).toBe(KEY_A);
		expect(entry.projectRoot).toBeNull();
		expect(entry.sessions.map((log) => log.sessionId)).toEqual([FIRST, SECOND]);
	});

	it("takes the root from the newest session even when an older one reported a different root", async () => {
		await writeProjectSession(
			KEY_A,
			FIRST,
			toLines([makeStart(FIRST, { projectRoot: "D:/old", ts: new Date(NOW - 3 * HOUR).toISOString() })]),
		);
		await writeProjectSession(
			KEY_A,
			SECOND,
			toLines([makeStart(SECOND, { projectRoot: "D:/new", ts: new Date(NOW - HOUR).toISOString() })]),
		);

		const [entry] = await read();

		expect(entry.projectRoot).toBe("D:/new");
	});

	it("does not list a project folder with an empty events folder", async () => {
		await mkdir(path.join(appData, "aidemd", KEY_A, "events"), { recursive: true });
		await writeProjectSession(KEY_B, FIRST, toLines([makeEvent(FIRST)]));

		expect((await read()).map((entry) => entry.projectKey)).toEqual([KEY_B]);
	});

	it("ignores observer.json and non-key folders at the root", async () => {
		await writeProjectSession(KEY_A, FIRST, toLines([makeEvent(FIRST)]));
		await writeFile(path.join(appData, "aidemd", "observer.json"), "{}", "utf-8");
		await writeProjectSession("not-a-key", FIRST, toLines([makeEvent(FIRST)]));

		expect((await read()).map((entry) => entry.projectKey)).toEqual([KEY_A]);
	});

	it("returns only the requested project for { projectKey }", async () => {
		await writeProjectSession(KEY_A, FIRST, toLines([makeEvent(FIRST)]));
		await writeProjectSession(KEY_B, FIRST, toLines([makeEvent(FIRST)]));

		expect((await read({ projectKey: KEY_B })).map((entry) => entry.projectKey)).toEqual([KEY_B]);
	});

	it("returns an empty list, never a throw, for an unknown or unsafe key", async () => {
		await writeProjectSession(KEY_A, FIRST, toLines([makeEvent(FIRST)]));

		expect(await read({ projectKey: "gone-000000" })).toEqual([]);
		expect(await read({ projectKey: "../x" })).toEqual([]);
	});

	it("skips only a malformed line and keeps the rest of the project", async () => {
		const broken = `${JSON.stringify(makeEvent(FIRST, { seq: 1 }))}\n{not json\n${JSON.stringify(makeEvent(FIRST, { seq: 2 }))}\n`;
		await writeProjectSession(KEY_A, FIRST, broken);
		await writeProjectSession(KEY_A, SECOND, toLines([makeEvent(SECOND)]));

		const [entry] = await read();

		expect(entry.sessions).toHaveLength(2);
		expect(entry.sessions[0].events).toHaveLength(2);
		expect(entry.sessions[0].skippedLines).toBe(1);
	});
});
