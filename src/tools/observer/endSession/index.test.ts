import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import resolve from "@/util/runtimePaths/resolve/index.js";
import resolveSessionLog from "@/util/runtimePaths/resolveSessionLog/index.js";
import resolvePresenceFile from "@/util/runtimePaths/resolvePresenceFile/index.js";
import resolveEndedMark from "@/util/runtimePaths/resolveEndedMark/index.js";
import getSession from "@/service/observer/event/record/session/index.js";
import endSessionService from "@/service/observer/event/endSession/index.js";
import record from "@/service/observer/event/record/index.js";
import endSession, { EndSessionInput } from "./index.js";

const OTHER = "20261125T090000000Z-bbbbbb";
const CLAUDE_OTHER = "claude-other";
const CLAUDE_OWN = "claude-own";
const LOG_CONTENT = '{"v":2}\n';

let appData: string;
let projectRoot: string;
let projectKey: string;

async function writeAt(file: string, content: string): Promise<void> {
	await mkdir(path.dirname(file), { recursive: true });
	await writeFile(file, content, "utf-8");
}

async function writePresence(claudeSessionId: string, sessionId: string): Promise<string> {
	const file = resolvePresenceFile({ projectKey, claudeSessionId });
	await writeAt(
		file,
		JSON.stringify({ v: 1, claudeSessionId, sessionId, state: "waiting", at: "2026-11-25T10:00:00.000Z", hookEvent: "Stop" }),
	);
	return file;
}

function markExists(id: string): Promise<boolean> {
	return readFile(resolveEndedMark({ projectKey, id }), "utf-8").then(
		() => true,
		() => false,
	);
}

beforeEach(async () => {
	appData = await mkdtemp(path.join(tmpdir(), "aide-end-tool-"));
	projectRoot = await mkdtemp(path.join(tmpdir(), "aide-end-tool-project-"));
	vi.stubEnv("AIDEMD_HOME", path.join(appData, "aidemd"));
	projectKey = resolve({ projectRoot }).projectKey;
});

afterEach(async () => {
	vi.unstubAllEnvs();
	await rm(appData, { recursive: true, force: true });
	await rm(projectRoot, { recursive: true, force: true });
});

describe("EndSessionInput", () => {
	it("accepts one non-empty sessionId and rejects extras and empties", () => {
		expect(EndSessionInput.safeParse({ sessionId: "x" }).success).toBe(true);
		expect(EndSessionInput.safeParse({ sessionId: "" }).success).toBe(false);
		expect(EndSessionInput.safeParse({ sessionId: "x", extra: 1 }).success).toBe(false);
		expect(EndSessionInput.safeParse({}).success).toBe(false);
	});
});

describe("endSession tool", () => {
	it("refuses a malformed input as an invalid session id", async () => {
		expect(await endSession({ root: projectRoot, input: { nope: true } })).toBe("refused: invalid session id");
		expect(await endSession({ root: projectRoot, input: "x" })).toBe("refused: invalid session id");
	});

	it("refuses an unsafe id as an invalid session id", async () => {
		expect(await endSession({ root: projectRoot, input: { sessionId: "../escape" } })).toBe("refused: invalid session id");
	});

	it("ends another session, writes its mark and deletes nothing", async () => {
		const log = resolveSessionLog({ projectKey, sessionId: OTHER });
		await writeAt(log, LOG_CONTENT);
		const presence = await writePresence(CLAUDE_OTHER, OTHER);

		expect(await endSession({ root: projectRoot, input: { sessionId: OTHER } })).toBe(`ended ${OTHER}`);

		expect(await markExists(OTHER)).toBe(true);
		expect(await readFile(log, "utf-8")).toBe(LOG_CONTENT);
		expect(await readFile(presence, "utf-8")).toContain(CLAUDE_OTHER);
	});

	it("answers already ended on a repeat", async () => {
		await writeAt(resolveSessionLog({ projectKey, sessionId: OTHER }), LOG_CONTENT);
		await endSession({ root: projectRoot, input: { sessionId: OTHER } });
		expect(await endSession({ root: projectRoot, input: { sessionId: OTHER } })).toBe(`already ended ${OTHER}`);
	});

	it("refuses an id no session of this project carries", async () => {
		expect(await endSession({ root: projectRoot, input: { sessionId: OTHER } })).toBe(
			`refused: no session ${OTHER} in this project`,
		);
	});

	it("refuses the caller's own session and its linked Claude id", async () => {
		const own = getSession().sessionId;
		await writePresence(CLAUDE_OWN, own);

		expect(await endSession({ root: projectRoot, input: { sessionId: own } })).toBe(`refused: ${own} is this session`);
		expect(await endSession({ root: projectRoot, input: { sessionId: CLAUDE_OWN } })).toBe(
			`refused: ${CLAUDE_OWN} is this session`,
		);
		expect(await markExists(own)).toBe(false);
		expect(await markExists(CLAUDE_OWN)).toBe(false);
	});

	it("makes the ended session's later events answer refused: session ended", async () => {
		// The recorder in this process records for getSession(); ending that session (as another
		// caller would) is what the refusal path keys on.
		const own = getSession().sessionId;
		await writeAt(resolveSessionLog({ projectKey, sessionId: own }), LOG_CONTENT);
		await endSessionService({ projectRoot, id: own, bySessionId: OTHER });

		const outcome = await record({ projectRoot, input: { kind: "release", version: "1.0.0" } });

		expect(outcome.logged).toBe("session-ended");
	});
});
