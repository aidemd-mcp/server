import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
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
import findOpenSessions from "./index.js";

const NOW = Date.parse("2026-11-25T12:00:00.000Z");
const MINUTE = 60 * 1000;
const CALLER = "20261125T110000000Z-caller";
const FIRST = "20261125T090000000Z-aaaaaa";
const SECOND = "20261125T100000000Z-bbbbbb";

let home: string;
let appData: string;
let project: string;

function at(minutesAgo: number): string {
	return new Date(NOW - minutesAgo * MINUTE).toISOString();
}

function makeEvent(sessionId: string, seq: number, minutesAgo: number, fields: Record<string, unknown>) {
	return { v: 2, ts: at(minutesAgo), sessionId, seq, pid: 4242, ...fields };
}

async function writeLog(sessionId: string, events: Record<string, unknown>[]): Promise<void> {
	const file = resolveEventLog({ projectRoot: project, sessionId });
	await mkdir(path.dirname(file), { recursive: true });
	await writeFile(file, events.map((event) => JSON.stringify(event)).join("\n") + "\n", "utf-8");
}

async function writePresence(claudeSessionId: string, fields: Record<string, unknown>): Promise<void> {
	const { projectKey } = resolve({ projectRoot: project });
	const file = resolvePresenceFile({ projectKey, claudeSessionId });
	await mkdir(path.dirname(file), { recursive: true });
	await writeFile(
		file,
		JSON.stringify({ v: 1, claudeSessionId, state: "working", at: at(0), hookEvent: "PostToolUse", ...fields }),
		"utf-8",
	);
}

async function writeMark(id: string, field: "sessionId" | "claudeSessionId"): Promise<void> {
	const { projectKey } = resolve({ projectRoot: project });
	const file = resolveEndedMark({ projectKey, id });
	await mkdir(path.dirname(file), { recursive: true });
	await writeFile(file, JSON.stringify({ v: 1, [field]: id, endedAt: at(1), endedBy: "user" }), "utf-8");
}

/** A v2 session that started a pipeline and opened a phase `minutesAgo` minutes back. */
function pipelineEvents(sessionId: string, minutesAgo: number): Record<string, unknown>[] {
	return [
		makeEvent(sessionId, 1, minutesAgo, { kind: "session_started" }),
		makeEvent(sessionId, 2, minutesAgo, { kind: "pipeline_started", pipeline: "feature-x", phase: "build" }),
		makeEvent(sessionId, 3, minutesAgo, {
			kind: "phase_started",
			pipeline: "feature-x",
			phase: "build",
			agent: "aide-implementor",
			module: "src/x",
		}),
	];
}

beforeEach(async () => {
	vi.clearAllMocks();
	vi.useFakeTimers({ toFake: ["Date"] });
	vi.setSystemTime(NOW);
	home = await mkdtemp(path.join(tmpdir(), "aide-open-home-"));
	appData = await mkdtemp(path.join(tmpdir(), "aide-open-appdata-"));
	project = await mkdtemp(path.join(tmpdir(), "aide-open-project-"));
	vi.mocked(homedir).mockReturnValue(home);
	vi.stubEnv("AIDEMD_HOME", path.join(appData, "aidemd"));
});

afterEach(async () => {
	vi.useRealTimers();
	vi.unstubAllEnvs();
	await Promise.all([home, appData, project].map((folder) => rm(folder, { recursive: true, force: true })));
});

describe("findOpenSessions", () => {
	it("answers nothing for a project with no files", async () => {
		expect(await findOpenSessions({ projectRoot: project, caller: { sessionIds: [CALLER], claudeSessionIds: [] } })).toEqual([]);
	});

	it("names another session with its pipeline and open phase", async () => {
		await writeLog(FIRST, pipelineEvents(FIRST, 1));

		const open = await findOpenSessions({ projectRoot: project, caller: { sessionIds: [CALLER], claudeSessionIds: [] } });

		expect(open).toHaveLength(1);
		expect(open[0]).toMatchObject({
			id: FIRST,
			idKind: "session",
			pipeline: "feature-x",
			phase: "build",
			liveness: { state: "working", quietMinutes: 1, maybeStuck: false },
		});
	});

	it("reports a waiting session as waiting", async () => {
		await writeLog(FIRST, pipelineEvents(FIRST, 1));
		await writePresence("claude-first", { sessionId: FIRST, state: "waiting", at: at(0) });

		const [open] = await findOpenSessions({ projectRoot: project, caller: { sessionIds: [CALLER], claudeSessionIds: [] } });

		expect(open.liveness.state).toBe("waiting");
	});

	it("keeps a hookless v2 session and a v1 session, each 40 minutes quiet, as open and maybe stuck", async () => {
		await writeLog(FIRST, pipelineEvents(FIRST, 40));
		await writeLog(SECOND, [{ v: 1, ts: at(40), sessionId: SECOND, seq: 1, pid: 4242, kind: "session_started" }]);

		const open = await findOpenSessions({ projectRoot: project, caller: { sessionIds: [CALLER], claudeSessionIds: [] } });

		expect(open.map((session) => session.id)).toEqual([FIRST, SECOND]);
		for (const session of open) {
			expect(session.liveness).toMatchObject({ state: "working", quietMinutes: 40, maybeStuck: true });
		}
		expect(open[1]).toMatchObject({ pipeline: null, phase: null });
	});

	it("never counts an ended session or the caller's own session", async () => {
		await writeLog(FIRST, pipelineEvents(FIRST, 1));
		await writeMark(FIRST, "sessionId");
		await writeLog(CALLER, pipelineEvents(CALLER, 0));

		expect(await findOpenSessions({ projectRoot: project, caller: { sessionIds: [CALLER], claudeSessionIds: [] } })).toEqual([]);
	});

	it("names an unlinked open presence by its Claude id, after the sessions, with no pipeline or phase", async () => {
		await writeLog(FIRST, pipelineEvents(FIRST, 1));
		await writePresence("claude-lonely", { state: "waiting" });

		const open = await findOpenSessions({ projectRoot: project, caller: { sessionIds: [CALLER], claudeSessionIds: [] } });

		expect(open.map((session) => [session.id, session.idKind])).toEqual([
			[FIRST, "session"],
			["claude-lonely", "claude"],
		]);
		expect(open[1]).toMatchObject({ pipeline: null, phase: null, liveness: { state: "waiting" } });
	});

	it("counts an unlinked presence even when the project has no log at all", async () => {
		await writePresence("claude-lonely", {});

		const open = await findOpenSessions({ projectRoot: project, caller: { sessionIds: [CALLER], claudeSessionIds: [] } });

		expect(open.map((session) => session.id)).toEqual(["claude-lonely"]);
	});

	it("skips an unlinked presence that is ended, by its state or by its mark", async () => {
		await writePresence("claude-done", { state: "ended", hookEvent: "SessionEnd" });
		await writePresence("claude-marked", {});
		await writeMark("claude-marked", "claudeSessionId");

		expect(await findOpenSessions({ projectRoot: project, caller: { sessionIds: [CALLER], claudeSessionIds: [] } })).toEqual([]);
	});

	it("does not count presence linked to the caller's own session", async () => {
		await writeLog(CALLER, pipelineEvents(CALLER, 0));
		await writePresence("claude-own", { sessionId: CALLER });

		expect(await findOpenSessions({ projectRoot: project, caller: { sessionIds: [CALLER], claudeSessionIds: [] } })).toEqual([]);
	});

	it("counts a resumed conversation once, by its newest observer session", async () => {
		await writeLog(FIRST, pipelineEvents(FIRST, 1));
		await writeLog(SECOND, pipelineEvents(SECOND, 1));
		await writePresence("claude-resumed", { sessionId: SECOND, earlierSessionIds: [FIRST] });

		const open = await findOpenSessions({ projectRoot: project, caller: { sessionIds: [CALLER], claudeSessionIds: [] } });

		expect(open.map((session) => [session.id, session.idKind])).toEqual([[SECOND, "session"]]);
	});

	it("never lists the caller's own earlier session or its Claude presence", async () => {
		await writeLog(FIRST, pipelineEvents(FIRST, 1));
		await writeLog(CALLER, pipelineEvents(CALLER, 0));
		await writePresence("claude-own", { sessionId: CALLER, earlierSessionIds: [FIRST] });
		await writePresence("claude-own-unlinked", {});

		const open = await findOpenSessions({
			projectRoot: project,
			caller: { sessionIds: [FIRST, CALLER], claudeSessionIds: ["claude-own", "claude-own-unlinked"] },
		});

		expect(open).toEqual([]);
	});

	it("does not list a session closed from its transcript", async () => {
		const transcript = path.join(project, "closed.jsonl");
		await writeFile(
			transcript,
			[JSON.stringify({ type: "user" }), JSON.stringify({ type: "cost-state", sessionId: "claude-closed" })].join("\n") + "\n",
			"utf-8",
		);
		await writeLog(FIRST, pipelineEvents(FIRST, 1));
		await writePresence("claude-closed", { sessionId: FIRST, transcriptPath: transcript });

		expect(
			await findOpenSessions({ projectRoot: project, caller: { sessionIds: [CALLER], claudeSessionIds: [] } }),
		).toEqual([]);
	});
});
