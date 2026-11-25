import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import resolve from "@/util/runtimePaths/resolve/index.js";
import resolveSessionLog from "@/util/runtimePaths/resolveSessionLog/index.js";
import resolveArchivedLog from "@/util/runtimePaths/resolveArchivedLog/index.js";
import resolveEndedMark from "@/util/runtimePaths/resolveEndedMark/index.js";
import resolvePresenceFile from "@/util/runtimePaths/resolvePresenceFile/index.js";
import endSession from "./index.js";

const CALLER = "20261125T100000000Z-aaaaaa";
const OTHER = "20261125T090000000Z-bbbbbb";
const ARCHIVED = "20261124T090000000Z-cccccc";
const CLAUDE_CALLER = "claude-caller";
const CLAUDE_OTHER = "claude-other";
const CLAUDE_LOOSE = "claude-loose";
const LOG_CONTENT = '{"v":2}\n';

let appData: string;
let projectRoot: string;
let projectKey: string;

async function writeAt(file: string, content: string): Promise<void> {
	await mkdir(path.dirname(file), { recursive: true });
	await writeFile(file, content, "utf-8");
}

async function writeLog(sessionId: string): Promise<string> {
	const file = resolveSessionLog({ projectKey, sessionId });
	await writeAt(file, LOG_CONTENT);
	return file;
}

async function writePresence(claudeSessionId: string, sessionId?: string): Promise<string> {
	const file = resolvePresenceFile({ projectKey, claudeSessionId });
	await writeAt(
		file,
		JSON.stringify({
			v: 1,
			claudeSessionId,
			...(sessionId ? { sessionId } : {}),
			state: "waiting",
			at: "2026-11-25T10:00:00.000Z",
			hookEvent: "Stop",
		}),
	);
	return file;
}

async function readMark(id: string): Promise<Record<string, unknown>> {
	return JSON.parse(await readFile(resolveEndedMark({ projectKey, id }), "utf-8"));
}

async function markExists(id: string): Promise<boolean> {
	return readFile(resolveEndedMark({ projectKey, id }), "utf-8").then(
		() => true,
		() => false,
	);
}

function end(id: string) {
	return endSession({ projectRoot, id, bySessionId: CALLER });
}

beforeEach(async () => {
	appData = await mkdtemp(path.join(tmpdir(), "aide-end-session-"));
	projectRoot = await mkdtemp(path.join(tmpdir(), "aide-end-project-"));
	vi.stubEnv("LOCALAPPDATA", appData);
	vi.stubEnv("XDG_STATE_HOME", appData);
	projectKey = resolve({ projectRoot }).projectKey;
});

afterEach(async () => {
	vi.unstubAllEnvs();
	await rm(appData, { recursive: true, force: true });
	await rm(projectRoot, { recursive: true, force: true });
});

describe("endSession refusals", () => {
	it.each(["", "../escape", "a/b", ".hidden"])("refuses the unsafe id %j as invalid-id", async (id) => {
		const outcome = await end(id);
		expect(outcome.outcome).toBe("invalid-id");
	});

	it("refuses the caller's own observer session and writes nothing", async () => {
		await writeLog(CALLER);
		expect(await end(CALLER)).toEqual({ outcome: "own-session", id: CALLER });
		expect(await markExists(CALLER)).toBe(false);
	});

	it("refuses a Claude session linked to the caller", async () => {
		await writePresence(CLAUDE_CALLER, CALLER);
		expect(await end(CLAUDE_CALLER)).toEqual({ outcome: "own-session", id: CLAUDE_CALLER });
		expect(await markExists(CLAUDE_CALLER)).toBe(false);
		expect(await markExists(CALLER)).toBe(false);
	});

	it("answers unknown for an id no log or presence of this project carries", async () => {
		expect(await end(OTHER)).toEqual({ outcome: "unknown", id: OTHER });
		expect(await markExists(OTHER)).toBe(false);
	});

	it("answers unknown for a session that only exists in another project", async () => {
		const foreignRoot = await mkdtemp(path.join(tmpdir(), "aide-end-foreign-"));
		try {
			const foreignKey = resolve({ projectRoot: foreignRoot }).projectKey;
			await writeAt(resolveSessionLog({ projectKey: foreignKey, sessionId: OTHER }), LOG_CONTENT);
			expect(await end(OTHER)).toEqual({ outcome: "unknown", id: OTHER });
			expect(await markExists(OTHER)).toBe(false);
		} finally {
			await rm(foreignRoot, { recursive: true, force: true });
		}
	});
});

describe("endSession writes the mark", () => {
	it("ends another session, leaving its log and presence untouched", async () => {
		const log = await writeLog(OTHER);
		const presenceFile = await writePresence(CLAUDE_OTHER, OTHER);
		const presenceBefore = await readFile(presenceFile, "utf-8");

		expect(await end(OTHER)).toEqual({ outcome: "ended", id: OTHER });

		const mark = await readMark(OTHER);
		expect(mark).toMatchObject({ v: 1, sessionId: OTHER, endedBy: "user", bySessionId: CALLER });
		expect(mark.claudeSessionId).toBeUndefined();
		expect(typeof mark.endedAt).toBe("string");
		expect(await readFile(log, "utf-8")).toBe(LOG_CONTENT);
		expect(await readFile(presenceFile, "utf-8")).toBe(presenceBefore);
	});

	it("ends an archived session of the project", async () => {
		await writeAt(resolveArchivedLog({ projectKey, sessionId: ARCHIVED }), LOG_CONTENT);
		expect(await end(ARCHIVED)).toEqual({ outcome: "ended", id: ARCHIVED });
		expect(await readMark(ARCHIVED)).toMatchObject({ sessionId: ARCHIVED, endedBy: "user" });
	});

	it("answers already-ended on a second call and leaves the first mark as written", async () => {
		await writeLog(OTHER);
		await end(OTHER);
		const first = await readFile(resolveEndedMark({ projectKey, id: OTHER }), "utf-8");

		expect(await end(OTHER)).toEqual({ outcome: "already-ended", id: OTHER });
		expect(await readFile(resolveEndedMark({ projectKey, id: OTHER }), "utf-8")).toBe(first);
	});

	it("writes a Claude-keyed mark for the Claude id of an unlinked presence", async () => {
		const presenceFile = await writePresence(CLAUDE_LOOSE);

		expect(await end(CLAUDE_LOOSE)).toEqual({ outcome: "ended", id: CLAUDE_LOOSE });

		const mark = await readMark(CLAUDE_LOOSE);
		expect(mark).toMatchObject({ v: 1, claudeSessionId: CLAUDE_LOOSE, endedBy: "user", bySessionId: CALLER });
		expect(mark.sessionId).toBeUndefined();
		expect(await readFile(presenceFile, "utf-8")).toContain(CLAUDE_LOOSE);
	});

	it("ends the observer session a Claude id is linked to, not the Claude id itself", async () => {
		await writePresence(CLAUDE_OTHER, OTHER);

		expect(await end(CLAUDE_OTHER)).toEqual({ outcome: "ended", id: CLAUDE_OTHER });

		expect(await readMark(OTHER)).toMatchObject({ sessionId: OTHER, endedBy: "user" });
		expect(await markExists(CLAUDE_OTHER)).toBe(false);
	});
});
