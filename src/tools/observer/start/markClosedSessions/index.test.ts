import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

vi.mock("node:os", async (importOriginal) => {
	const actual = await importOriginal<typeof import("node:os")>();
	return { ...actual, homedir: vi.fn(() => actual.homedir()) };
});

vi.mock("@/service/observer/event/markClosed/index.js", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/service/observer/event/markClosed/index.js")>();
	return { default: vi.fn(actual.default) };
});

import { homedir } from "node:os";
import markClosed from "@/service/observer/event/markClosed/index.js";
import resolve from "@/util/runtimePaths/resolve/index.js";
import resolveEventLog from "@/util/runtimePaths/resolveEventLog/index.js";
import resolvePresenceFile from "@/util/runtimePaths/resolvePresenceFile/index.js";
import resolveEndedMark from "@/util/runtimePaths/resolveEndedMark/index.js";
import markClosedSessions from "./index.js";

const NOW = Date.parse("2026-11-25T12:00:00.000Z");
const CALLER = "20261125T110000000Z-caller";
const EARLIER_OWN = "20261125T080000000Z-earlie";
const OTHER = "20261125T090000000Z-aaaaaa";
const OTHER_NEWER = "20261125T100000000Z-bbbbbb";
const NO_CALLER = { sessionIds: [CALLER], claudeSessionIds: [] };

let home: string;
let appData: string;
let project: string;

function at(minutesAgo: number): string {
	return new Date(NOW - minutesAgo * 60 * 1000).toISOString();
}

async function writeLog(sessionId: string): Promise<void> {
	const file = resolveEventLog({ projectRoot: project, sessionId });
	await mkdir(path.dirname(file), { recursive: true });
	const event = { v: 2, ts: at(5), sessionId, seq: 1, pid: 4242, kind: "session_started" };
	await writeFile(file, JSON.stringify(event) + "\n", "utf-8");
}

/** A transcript that ends in its own closing record (`closed`) or in an ordinary record. */
async function writeTranscript(name: string, claudeSessionId: string, closed: boolean): Promise<string> {
	const file = path.join(project, `${name}.jsonl`);
	const last = closed ? { type: "cost-state", sessionId: claudeSessionId } : { type: "assistant" };
	await writeFile(file, [JSON.stringify({ type: "user" }), JSON.stringify(last)].join("\n") + "\n", "utf-8");
	return file;
}

async function writePresence(claudeSessionId: string, fields: Record<string, unknown>): Promise<void> {
	const { projectKey } = resolve({ projectRoot: project });
	const file = resolvePresenceFile({ projectKey, claudeSessionId });
	await mkdir(path.dirname(file), { recursive: true });
	await writeFile(
		file,
		JSON.stringify({ v: 1, claudeSessionId, state: "working", at: at(1), hookEvent: "PostToolUse", ...fields }),
		"utf-8",
	);
}

async function readMark(id: string): Promise<Record<string, unknown> | null> {
	const { projectKey } = resolve({ projectRoot: project });
	try {
		return JSON.parse(await readFile(resolveEndedMark({ projectKey, id }), "utf-8"));
	} catch {
		return null;
	}
}

beforeEach(async () => {
	vi.clearAllMocks();
	vi.useFakeTimers({ toFake: ["Date"] });
	vi.setSystemTime(NOW);
	home = await mkdtemp(path.join(tmpdir(), "aide-mark-home-"));
	appData = await mkdtemp(path.join(tmpdir(), "aide-mark-appdata-"));
	project = await mkdtemp(path.join(tmpdir(), "aide-mark-project-"));
	vi.mocked(homedir).mockReturnValue(home);
	vi.stubEnv("AIDEMD_HOME", path.join(appData, "aidemd"));
});

afterEach(async () => {
	vi.useRealTimers();
	vi.unstubAllEnvs();
	await Promise.all([home, appData, project].map((folder) => rm(folder, { recursive: true, force: true })));
});

describe("markClosedSessions", () => {
	it("marks a transcript-closed other session once, with the caller's session id as bySessionId", async () => {
		await writeLog(OTHER);
		const transcriptPath = await writeTranscript("other", "claude-other", true);
		await writePresence("claude-other", { sessionId: OTHER, transcriptPath });

		await markClosedSessions({ projectRoot: project, caller: NO_CALLER, bySessionId: CALLER });

		expect(await readMark(OTHER)).toMatchObject({ sessionId: OTHER, endedBy: "transcript", bySessionId: CALLER });
	});

	it("marks a transcript-closed presence that never linked, by its Claude id", async () => {
		const transcriptPath = await writeTranscript("lonely", "claude-lonely", true);
		await writePresence("claude-lonely", { transcriptPath });

		await markClosedSessions({ projectRoot: project, caller: NO_CALLER, bySessionId: CALLER });

		expect(await readMark("claude-lonely")).toMatchObject({
			claudeSessionId: "claude-lonely",
			endedBy: "transcript",
			bySessionId: CALLER,
		});
	});

	it("marks a resumed conversation once, through its newest session", async () => {
		await writeLog(OTHER);
		await writeLog(OTHER_NEWER);
		const transcriptPath = await writeTranscript("resumed", "claude-resumed", true);
		await writePresence("claude-resumed", { sessionId: OTHER_NEWER, earlierSessionIds: [OTHER], transcriptPath });

		await markClosedSessions({ projectRoot: project, caller: NO_CALLER, bySessionId: CALLER });

		expect(vi.mocked(markClosed)).toHaveBeenCalledTimes(1);
		expect(vi.mocked(markClosed)).toHaveBeenCalledWith({
			projectKey: resolve({ projectRoot: project }).projectKey,
			id: OTHER_NEWER,
			bySessionId: CALLER,
		});
	});

	it("leaves an already-marked session untouched", async () => {
		await writeLog(OTHER);
		const transcriptPath = await writeTranscript("other", "claude-other", true);
		await writePresence("claude-other", { sessionId: OTHER, transcriptPath });
		const { projectKey } = resolve({ projectRoot: project });
		const markFile = resolveEndedMark({ projectKey, id: OTHER });
		await mkdir(path.dirname(markFile), { recursive: true });
		const existing = { v: 1, sessionId: OTHER, endedAt: at(30), endedBy: "user" };
		await writeFile(markFile, JSON.stringify(existing), "utf-8");

		await markClosedSessions({ projectRoot: project, caller: NO_CALLER, bySessionId: CALLER });

		expect(await readMark(OTHER)).toEqual(existing);
	});

	it("never marks the caller's own transcript-closed earlier session", async () => {
		await writeLog(EARLIER_OWN);
		await writeLog(CALLER);
		const transcriptPath = await writeTranscript("own", "claude-own", true);
		await writePresence("claude-own", { sessionId: CALLER, earlierSessionIds: [EARLIER_OWN], transcriptPath });

		await markClosedSessions({
			projectRoot: project,
			caller: { sessionIds: [EARLIER_OWN, CALLER], claudeSessionIds: ["claude-own"] },
			bySessionId: CALLER,
		});

		expect(vi.mocked(markClosed)).not.toHaveBeenCalled();
		expect(await readMark(EARLIER_OWN)).toBeNull();
		expect(await readMark(CALLER)).toBeNull();
	});

	it("does not mark a session whose transcript is still open", async () => {
		await writeLog(OTHER);
		const transcriptPath = await writeTranscript("other", "claude-other", false);
		await writePresence("claude-other", { sessionId: OTHER, transcriptPath });

		await markClosedSessions({ projectRoot: project, caller: NO_CALLER, bySessionId: CALLER });

		expect(vi.mocked(markClosed)).not.toHaveBeenCalled();
	});

	it("does not throw when a write fails, and still marks the others", async () => {
		await writeLog(OTHER);
		const otherTranscript = await writeTranscript("other", "claude-other", true);
		await writePresence("claude-other", { sessionId: OTHER, transcriptPath: otherTranscript });
		const lonelyTranscript = await writeTranscript("lonely", "claude-lonely", true);
		await writePresence("claude-lonely", { transcriptPath: lonelyTranscript });
		vi.mocked(markClosed).mockRejectedValueOnce(new Error("EACCES"));

		await expect(
			markClosedSessions({ projectRoot: project, caller: NO_CALLER, bySessionId: CALLER }),
		).resolves.toBeUndefined();

		expect(vi.mocked(markClosed)).toHaveBeenCalledTimes(2);
		const marks = [await readMark(OTHER), await readMark("claude-lonely")].filter((mark) => mark !== null);
		expect(marks).toHaveLength(1);
	});

	it("does not throw when the project's files cannot be read", async () => {
		vi.mocked(markClosed).mockRejectedValue(new Error("EIO"));
		await writePresence("claude-lonely", { transcriptPath: await writeTranscript("lonely", "claude-lonely", true) });

		await expect(
			markClosedSessions({ projectRoot: project, caller: NO_CALLER, bySessionId: CALLER }),
		).resolves.toBeUndefined();
	});
});
