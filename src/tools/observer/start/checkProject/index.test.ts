import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

vi.mock("node:os", async (importOriginal) => {
	const actual = await importOriginal<typeof import("node:os")>();
	return { ...actual, homedir: vi.fn(() => actual.homedir()) };
});

import { homedir } from "node:os";
import resolve from "@/util/runtimePaths/resolve/index.js";
import resolveEventLog from "@/util/runtimePaths/resolveEventLog/index.js";
import resolvePresenceFile from "@/util/runtimePaths/resolvePresenceFile/index.js";
import resolveEndedMark from "@/util/runtimePaths/resolveEndedMark/index.js";
import type { LinkReply } from "../types/index.js";
import checkProject from "./index.js";

const CALLER = "20261125T110000000Z-caller";
const EARLIER = "20261125T080000000Z-earlie";
const OLDER_OTHER = "20261125T070000000Z-otherr";
const LATER = "20261125T120000000Z-laterr";
const REPLY: LinkReply = { outcome: "running", link: "http://127.0.0.1:24680/link" };

let home: string;
let appData: string;
let project: string;

function projectKey(): string {
	return resolve({ projectRoot: project }).projectKey;
}

async function writeLog(sessionId: string): Promise<void> {
	const file = resolveEventLog({ projectRoot: project, sessionId });
	await mkdir(path.dirname(file), { recursive: true });
	const event = { v: 2, ts: new Date(Date.now() - 60_000).toISOString(), sessionId, seq: 1, pid: 4242, kind: "session_started" };
	await writeFile(file, JSON.stringify(event) + "\n", "utf-8");
}

async function writePresence(claudeSessionId: string, fields: Record<string, unknown>): Promise<void> {
	const file = resolvePresenceFile({ projectKey: projectKey(), claudeSessionId });
	await mkdir(path.dirname(file), { recursive: true });
	const presence = { v: 1, claudeSessionId, state: "working", at: new Date().toISOString(), hookEvent: "PostToolUse", ...fields };
	await writeFile(file, JSON.stringify(presence), "utf-8");
}

async function writeMark(id: string, endedBy: "hook" | "user"): Promise<void> {
	const file = resolveEndedMark({ projectKey: projectKey(), id });
	await mkdir(path.dirname(file), { recursive: true });
	await writeFile(file, JSON.stringify({ v: 1, sessionId: id, endedAt: new Date().toISOString(), endedBy }), "utf-8");
}

async function readMark(id: string): Promise<Record<string, unknown> | null> {
	try {
		return JSON.parse(await readFile(resolveEndedMark({ projectKey: projectKey(), id }), "utf-8"));
	} catch {
		return null;
	}
}

/** The caller's conversation: the current session linked to an earlier one, which carries `mark`. */
async function writeEndedCaller(mark: "hook" | "user" | null): Promise<void> {
	await writeLog(EARLIER);
	await writePresence("claude-own", { sessionId: CALLER, earlierSessionIds: [EARLIER] });
	if (mark !== null) await writeMark(EARLIER, mark);
}

function check() {
	return checkProject({ projectRoot: project, sessionId: CALLER, reply: REPLY });
}

beforeEach(async () => {
	home = await mkdtemp(path.join(tmpdir(), "aide-check-home-"));
	appData = await mkdtemp(path.join(tmpdir(), "aide-check-appdata-"));
	project = await mkdtemp(path.join(tmpdir(), "aide-check-project-"));
	vi.mocked(homedir).mockReturnValue(home);
	vi.stubEnv("AIDEMD_HOME", path.join(appData, "aidemd"));
});

afterEach(async () => {
	vi.unstubAllEnvs();
	await Promise.all([home, appData, project].map((folder) => rm(folder, { recursive: true, force: true })));
});

describe("checkProject", () => {
	it("reopens a conversation ended by its hook when nothing newer or open exists, clearing the mark", async () => {
		await writeEndedCaller("hook");

		const reply = await check();

		expect(reply).toEqual({ outcome: "reopened", reply: REPLY });
		expect(await readMark(EARLIER)).toBeNull();
	});

	it("stops a conversation the user ended, keeping the mark", async () => {
		await writeEndedCaller("user");

		const reply = await check();

		expect(reply).toEqual({ outcome: "stopped", reason: "user", link: REPLY.link });
		expect(await readMark(EARLIER)).toMatchObject({ endedBy: "user" });
	});

	it("stops with newer when a later session has worked the project, keeping the mark", async () => {
		await writeEndedCaller("hook");
		await writeLog(LATER);
		await writeMark(LATER, "hook");

		const reply = await check();

		expect(reply).toEqual({ outcome: "stopped", reason: "newer", link: REPLY.link });
		expect(await readMark(EARLIER)).toMatchObject({ endedBy: "hook" });
	});

	it("halts an ended caller while an older session is open, keeping the mark", async () => {
		await writeEndedCaller("hook");
		await writeLog(OLDER_OTHER);

		const reply = await check();

		expect(reply).toMatchObject({ outcome: "halt", link: REPLY.link, open: [{ id: OLDER_OTHER, idKind: "session" }] });
		expect(await readMark(EARLIER)).toMatchObject({ endedBy: "hook" });
	});

	it("halts a caller with no mark when another session is open", async () => {
		await writeLog(OLDER_OTHER);

		const reply = await check();

		expect(reply).toMatchObject({ outcome: "halt", link: REPLY.link, open: [{ id: OLDER_OTHER }] });
	});

	it("answers the link reply unchanged for a caller with no mark and nothing open", async () => {
		expect(await check()).toEqual(REPLY);
	});

	it("never halts for the caller's own earlier session", async () => {
		await writeEndedCaller(null);

		expect(await check()).toEqual(REPLY);
	});

	it("marks another session closed from its transcript even when the reply is a hard stop", async () => {
		await writeEndedCaller("user");
		await writeLog(OLDER_OTHER);
		const transcriptPath = path.join(project, "other.jsonl");
		const records = [{ type: "user" }, { type: "cost-state", sessionId: "claude-other" }];
		await writeFile(transcriptPath, records.map((record) => JSON.stringify(record)).join("\n") + "\n", "utf-8");
		await writePresence("claude-other", { sessionId: OLDER_OTHER, transcriptPath });

		const reply = await check();

		expect(reply).toMatchObject({ outcome: "stopped", reason: "user" });
		expect(await readMark(OLDER_OTHER)).toMatchObject({ endedBy: "transcript", bySessionId: CALLER });
	});
});
