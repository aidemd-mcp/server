import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdtemp, readdir, readFile, rm, writeFile, mkdir } from "node:fs/promises";
import { createServer, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";

vi.mock("node:os", async (importOriginal) => {
	const actual = await importOriginal<typeof import("node:os")>();
	return { ...actual, homedir: vi.fn(() => actual.homedir()) };
});
vi.mock("@/util/isProcessRunning/index.js", () => ({ default: vi.fn(() => true) }));

import { homedir } from "node:os";
import resolve from "@/util/runtimePaths/resolve/index.js";
import create from "@/util/runtimePaths/create/index.js";
import writeEndedMark from "@/service/observer/event/shared/writeEndedMark/index.js";
import resolveEndedMark from "@/util/runtimePaths/resolveEndedMark/index.js";
import resolvePresenceFile from "@/util/runtimePaths/resolvePresenceFile/index.js";
import resolveRoot from "@/util/runtimePaths/resolveRoot/index.js";
import resolveEventLog from "@/util/runtimePaths/resolveEventLog/index.js";
import { schema } from "@/service/observer/event/shared/schema/index.js";
import type { ObserverEvent } from "@/service/observer/event/shared/schema/index.js";

const mockHomedir = vi.mocked(homedir);

type Record = typeof import("./index.js").default;
type GetSession = typeof import("./session/index.js").default;

let record: Record;
let getSession: GetSession;
let home: string;
let appData: string;
let project: string;
let server: Server;
let received: string[];
let respond: (response: ServerResponse, body: string) => void;
let atRequest: (body: string) => Promise<void>;

async function writeObserverRecord(): Promise<void> {
	const paths = resolveRoot();
	await mkdir(paths.root, { recursive: true });
	const address = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
	await writeFile(paths.observerFile, JSON.stringify({ address, token: "t", pid: process.pid, version: "1.0.0" }));
}

async function readLines(): Promise<string[]> {
	const file = resolveEventLog({ projectRoot: project, sessionId: getSession().sessionId });
	const content = await readFile(file, "utf-8");
	return content.split("\n").filter((line) => line !== "");
}

beforeEach(async () => {
	vi.resetModules();
	record = (await import("./index.js")).default;
	getSession = (await import("./session/index.js")).default;

	home = await mkdtemp(path.join(tmpdir(), "aide-record-home-"));
	appData = await mkdtemp(path.join(tmpdir(), "aide-record-appdata-"));
	project = await mkdtemp(path.join(tmpdir(), "aide-record-project-"));
	vi.mocked((await import("node:os")).homedir).mockReturnValue(home);
	mockHomedir.mockReturnValue(home);
	vi.stubEnv("AIDEMD_HOME", path.join(appData, "aidemd"));

	received = [];
	atRequest = async () => {};
	respond = (response) => response.writeHead(200).end("ok");
	server = createServer((request, response) => {
		const chunks: Buffer[] = [];
		request.on("data", (chunk: Buffer) => chunks.push(chunk));
		request.on("end", () => {
			const body = Buffer.concat(chunks).toString("utf-8");
			received.push(body);
			void atRequest(body).then(() => respond(response, body));
		});
	});
	await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
});

afterEach(async () => {
	// The project folder must never receive anything.
	expect(await readdir(project)).toEqual([]);
	server.closeAllConnections();
	await new Promise<void>((done) => server.close(() => done()));
	vi.unstubAllEnvs();
	await Promise.all([home, appData, project].map((folder) => rm(folder, { recursive: true, force: true })));
});

describe("record", () => {
	it("writes the event and reports delivered false when no observer runs", async () => {
		const outcome = await record({ projectRoot: project, input: { kind: "release", version: "1.0.0" } });

		expect(outcome).toEqual({ logged: "written", delivered: false, sessionId: getSession().sessionId, previouslyEnded: false });
		expect(await readLines()).toHaveLength(1);
		expect(received).toEqual([]);
	});

	it("appends first, then notifies: the line is already on disk when the observer receives it", async () => {
		await writeObserverRecord();
		let linesAtRequest: string[] = [];
		atRequest = async () => {
			linesAtRequest = await readLines();
		};

		const outcome = await record({ projectRoot: project, input: { kind: "release", version: "1.0.0" } });

		expect(outcome).toEqual({ logged: "written", delivered: true, sessionId: getSession().sessionId, previouslyEnded: false });
		expect(linesAtRequest).toHaveLength(1);
		expect(received).toEqual(linesAtRequest);
	});

	it("resolves within a second with delivered false when the observer is slow", async () => {
		await writeObserverRecord();
		respond = (response) => {
			setTimeout(() => response.writeHead(200).end("late"), 2000);
		};

		const started = Date.now();
		const outcome = await record({ projectRoot: project, input: { kind: "release", version: "1.0.0" } });

		expect(outcome).toEqual({ logged: "written", delivered: false, sessionId: getSession().sessionId, previouslyEnded: false });
		expect(Date.now() - started).toBeLessThan(1000);
	});

	it("reports write-failed without throwing when the append fails, and still posts to a running observer", async () => {
		await writeObserverRecord();
		// A regular FILE named `events` makes the events folder impossible.
		const paths = resolve({ projectRoot: project });
		await mkdir(paths.folder, { recursive: true });
		await writeFile(paths.eventsFolder, "not a folder");

		const outcome = await record({ projectRoot: project, input: { kind: "release", version: "1.0.0" } });

		expect(outcome.logged).toBe("write-failed");
		expect(outcome.delivered).toBe(true);
		expect(outcome.detail).toBeTruthy();
		expect(received).toHaveLength(1);
	});

	it.each([
		["an unknown kind", { kind: "nope" }],
		["a prompt without text", { kind: "prompt" }],
		["an input carrying seq", { kind: "release", version: "1.0.0", seq: 5 }],
	])("rejects %s without writing or posting", async (_label, input) => {
		await writeObserverRecord();

		const outcome = await record({ projectRoot: project, input });

		expect(outcome.logged).toBe("invalid");
		expect(outcome.delivered).toBe(false);
		expect(outcome.previouslyEnded).toBe(false);
		expect(outcome.detail).toBeTruthy();
		expect(received).toEqual([]);
		const paths = resolve({ projectRoot: project });
		await expect(readdir(paths.eventsFolder)).rejects.toThrow();
	});

	it("stamps every event with one session id, rising seq, the process pid, v 2 and an ISO ts", async () => {
		await record({ projectRoot: project, input: { kind: "release", version: "1.0.0" } });
		await record({ projectRoot: project, input: { kind: "release", version: "1.0.1" } });
		await record({ projectRoot: project, input: { kind: "release", version: "1.0.2" } });

		const events = (await readLines()).map((line) => schema.parse(JSON.parse(line)));
		expect(new Set(events.map((event) => event.sessionId)).size).toBe(1);
		expect(events[0]!.sessionId).toMatch(/^\d{8}T\d{9}Z-[0-9a-f]{6}$/);
		expect(events.map((event) => event.seq)).toEqual([1, 2, 3]);
		for (const event of events) {
			expect(event.pid).toBe(process.pid);
			expect(event.v).toBe(2);
			expect(new Date(event.ts).toISOString()).toBe(event.ts);
		}
	});

	it("refuses a second session_started and leaves no seq gap", async () => {
		const first = await record({ projectRoot: project, input: { kind: "session_started" } });
		const second = await record({ projectRoot: project, input: { kind: "session_started" } });
		const next = await record({ projectRoot: project, input: { kind: "release", version: "1.0.0" } });

		expect(first.logged).toBe("written");
		expect(second).toEqual({
			logged: "repeat-session-start",
			delivered: false,
			sessionId: getSession().sessionId,
			previouslyEnded: false,
		});
		expect(next.logged).toBe("written");
		const events = (await readLines()).map((line) => JSON.parse(line) as ObserverEvent);
		expect(events.filter((event) => event.kind === "session_started")).toHaveLength(1);
		expect(events.map((event) => event.seq)).toEqual([1, 2]);
	});

	it("stores a session_started with only kanbanTag as exactly kind, kanbanTag and the envelope", async () => {
		await record({ projectRoot: project, input: { kind: "session_started", kanbanTag: "aidemd-mcp" } });

		const [line] = await readLines();
		expect(Object.keys(JSON.parse(line!) as object).sort()).toEqual(
			["kanbanTag", "kind", "pid", "seq", "sessionId", "ts", "v"].sort(),
		);
	});

	it("keeps 20 concurrent records whole and in seq order", async () => {
		await Promise.all(
			Array.from({ length: 20 }, (_, index) =>
				record({ projectRoot: project, input: { kind: "release", version: `1.0.${index}` } }),
			),
		);

		const lines = await readLines();
		expect(lines).toHaveLength(20);
		const events = lines.map((line) => JSON.parse(line) as ObserverEvent);
		expect(events.map((event) => event.seq)).toEqual(Array.from({ length: 20 }, (_, index) => index + 1));
	});

	describe("after the session is ended", () => {
		const EARLIER = "20200101T000000000Z-aaaaaa";

		async function markConversation({ id, endedBy }: { id: string; endedBy: "hook" | "user" }): Promise<string> {
			const paths = await create({ projectRoot: project });
			await writeEndedMark({
				projectKey: paths.projectKey,
				mark: { v: 1, sessionId: id, endedAt: new Date().toISOString(), endedBy },
			});
			return paths.projectKey;
		}

		it("appends and posts the event and flags previouslyEnded", async () => {
			await writeObserverRecord();
			await markConversation({ id: getSession().sessionId, endedBy: "user" });

			const outcome = await record({ projectRoot: project, input: { kind: "release", version: "1.0.0" } });

			expect(outcome).toEqual({
				logged: "written",
				delivered: true,
				sessionId: getSession().sessionId,
				previouslyEnded: true,
			});
			expect(await readLines()).toHaveLength(1);
			expect(received).toHaveLength(1);
		});

		it("flags a mark on an earlier observer session of the same Claude session", async () => {
			const projectKey = await markConversation({ id: EARLIER, endedBy: "hook" });
			const presenceFile = resolvePresenceFile({ projectKey, claudeSessionId: "claude-1" });
			await mkdir(path.dirname(presenceFile), { recursive: true });
			await writeFile(
				presenceFile,
				JSON.stringify({
					v: 1,
					claudeSessionId: "claude-1",
					sessionId: getSession().sessionId,
					earlierSessionIds: [EARLIER],
					state: "working",
					at: new Date().toISOString(),
					hookEvent: "PostToolUse",
				}),
			);

			const outcome = await record({ projectRoot: project, input: { kind: "release", version: "1.0.0" } });

			expect(outcome.logged).toBe("written");
			expect(outcome.previouslyEnded).toBe(true);
		});

		it("records a session_started and claims the start", async () => {
			await markConversation({ id: getSession().sessionId, endedBy: "hook" });

			const outcome = await record({ projectRoot: project, input: { kind: "session_started" } });

			expect(outcome.logged).toBe("written");
			expect(outcome.previouslyEnded).toBe(true);
			expect(getSession().startedRecorded).toBe(true);
		});

		it("flags a repeat session_started too", async () => {
			await markConversation({ id: getSession().sessionId, endedBy: "hook" });
			await record({ projectRoot: project, input: { kind: "session_started" } });

			const repeat = await record({ projectRoot: project, input: { kind: "session_started" } });

			expect(repeat).toEqual({
				logged: "repeat-session-start",
				delivered: false,
				sessionId: getSession().sessionId,
				previouslyEnded: true,
			});
		});

		it("reports previouslyEnded false when there is no mark", async () => {
			const outcome = await record({ projectRoot: project, input: { kind: "release", version: "1.0.0" } });

			expect(outcome.previouslyEnded).toBe(false);
		});

		it("counts an unreadable mark as no mark", async () => {
			const paths = await create({ projectRoot: project });
			const markFile = resolveEndedMark({ projectKey: paths.projectKey, id: getSession().sessionId });
			await mkdir(path.dirname(markFile), { recursive: true });
			await writeFile(markFile, "{ not json");

			const outcome = await record({ projectRoot: project, input: { kind: "release", version: "1.0.0" } });

			expect(outcome.logged).toBe("written");
			expect(outcome.previouslyEnded).toBe(false);
		});

		it("still reports invalid for a bad input, naming the session and not flagging", async () => {
			await markConversation({ id: getSession().sessionId, endedBy: "user" });

			const outcome = await record({ projectRoot: project, input: { kind: "nope" } });

			expect(outcome.logged).toBe("invalid");
			expect(outcome.previouslyEnded).toBe(false);
			expect(outcome.sessionId).toBe(getSession().sessionId);
		});
	});

	it("names the session id on every outcome", async () => {
		const written = await record({ projectRoot: project, input: { kind: "release", version: "1.0.0" } });
		const invalid = await record({ projectRoot: project, input: { kind: "nope" } });
		const repeat1 = await record({ projectRoot: project, input: { kind: "session_started" } });
		const repeat2 = await record({ projectRoot: project, input: { kind: "session_started" } });
		const failed = await record({ projectRoot: "relative/path", input: { kind: "release", version: "1.0.0" } });

		for (const outcome of [written, invalid, repeat1, repeat2, failed]) {
			expect(outcome.sessionId).toBe(getSession().sessionId);
		}
	});

	it("resolves write-failed, never rejects, for a relative projectRoot", async () => {
		const outcome = await record({ projectRoot: "relative/path", input: { kind: "release", version: "1.0.0" } });

		expect(outcome.logged).toBe("write-failed");
		expect(outcome.delivered).toBe(false);
	});
});
