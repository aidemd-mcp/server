import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { schema } from "@/service/observer/event/shared/schema/index.js";
import resolveRoot from "@/util/runtimePaths/resolveRoot/index.js";
import writeSessionLog from "./index.js";
import type { FixtureEvent, FixtureSession } from "@/observer/seedFixtures/types/index.js";

const NOW = Date.parse("2026-11-23T12:00:00.000Z");

let base: string;
let projectRoot: string;

beforeEach(async () => {
	base = await mkdtemp(join(tmpdir(), "aide-write-log-"));
	projectRoot = join(base, "project");
	vi.stubEnv("LOCALAPPDATA", join(base, "appdata"));
	vi.stubEnv("XDG_STATE_HOME", join(base, "appdata"));
});

afterEach(async () => {
	vi.unstubAllEnvs();
	await rm(base, { recursive: true, force: true });
});

function makeSession(overrides: Partial<FixtureSession> = {}): FixtureSession {
	const events: FixtureEvent[] = [
		{ offsetMin: 30, kind: "session_started" },
		{ offsetMin: 20, kind: "prompt", text: "Start the plan" },
		{ offsetMin: 5, kind: "phase_started", pipeline: "rank-misaligned", phase: "build", agent: "aide-implementor", module: "src/tools/score" },
	];
	return { pid: "live", events, ...overrides };
}

async function readLog({ projectKey, sessionId }: { projectKey: string; sessionId: string }): Promise<unknown[]> {
	const file = join(resolveRoot().root, projectKey, "events", `${sessionId}.jsonl`);
	const text = await readFile(file, "utf-8");
	return text.trimEnd().split("\n").map((line) => JSON.parse(line));
}

describe("writeSessionLog", () => {
	it("writes lines that all parse with the event schema, seq 1..n, ts = now minus the offset", async () => {
		const written = await writeSessionLog({ projectRoot, session: makeSession(), now: NOW });
		const lines = await readLog(written);

		const events = lines.map((line) => schema.parse(line));
		expect(events.map((event) => event.seq)).toEqual([1, 2, 3]);
		expect(events.map((event) => event.ts)).toEqual([
			"2026-11-23T11:30:00.000Z",
			"2026-11-23T11:40:00.000Z",
			"2026-11-23T11:55:00.000Z",
		]);
		expect(new Set(events.map((event) => event.sessionId))).toEqual(new Set([written.sessionId]));
		expect(events.map((event) => event.v)).toEqual([2, 2, 2]);
	});

	it("stamps process.pid for a live session", async () => {
		const written = await writeSessionLog({ projectRoot, session: makeSession({ pid: "live" }), now: NOW });

		const pids = (await readLog(written)).map((line) => schema.parse(line).pid);
		expect(pids).toEqual([process.pid, process.pid, process.pid]);
	});

	it("stamps one exited pid for a dead session", async () => {
		const written = await writeSessionLog({ projectRoot, session: makeSession({ pid: "dead" }), now: NOW });

		const pids = (await readLog(written)).map((line) => schema.parse(line).pid);
		expect(new Set(pids).size).toBe(1);
		expect(pids[0]).not.toBe(process.pid);
		expect(() => process.kill(pids[0], 0)).toThrow();
	});

	it("builds an id from the oldest event's time that sorts by age", async () => {
		const older = await writeSessionLog({ projectRoot, session: makeSession(), now: NOW });
		const newer = await writeSessionLog({
			projectRoot,
			session: { pid: "live", events: [{ offsetMin: 2, kind: "session_started" }] },
			now: NOW,
		});

		expect(older.sessionId).toMatch(/^20261123T113000000Z-[0-9a-f]{6}$/);
		expect(newer.sessionId).toMatch(/^20261123T115800000Z-[0-9a-f]{6}$/);
		expect(older.sessionId < newer.sessionId).toBe(true);
	});

	it("fills the first event's root, tag and brain folder, and lets the event's own values win", async () => {
		const reported = { projectRoot, kanbanTag: "aidemd-mcp", brainPath: join(base, "brain") };
		const own = makeSession({ events: [{ offsetMin: 3, kind: "session_started", kanbanTag: "own-tag" }] });

		const filled = await writeSessionLog({ projectRoot, session: makeSession(), now: NOW, reported });
		const kept = await writeSessionLog({ projectRoot, session: own, now: NOW, reported });

		expect((await readLog(filled))[0]).toMatchObject(reported);
		expect((await readLog(kept))[0]).toMatchObject({ kanbanTag: "own-tag", projectRoot });
	});

	it("reports no root when none is given", async () => {
		const written = await writeSessionLog({ projectRoot, session: makeSession(), now: NOW });

		expect((await readLog(written))[0]).not.toHaveProperty("projectRoot");
	});

	it("writes under the app-data root, never under the project", async () => {
		const written = await writeSessionLog({ projectRoot, session: makeSession(), now: NOW });

		expect(written.projectKey).toMatch(/^project-[0-9a-f]{6}$/);
		expect(await readdir(join(resolveRoot().root, written.projectKey, "events"))).toEqual([`${written.sessionId}.jsonl`]);
		await expect(readdir(projectRoot)).rejects.toThrow();
	});

	it("throws when the first event is not session_started", async () => {
		const session = makeSession({ events: [{ offsetMin: 5, kind: "prompt", text: "hi" }] });

		await expect(writeSessionLog({ projectRoot, session, now: NOW })).rejects.toThrow("must start with session_started");
	});

	it("throws, writing nothing, when an event fails the schema", async () => {
		const session = makeSession({
			events: [
				{ offsetMin: 9, kind: "session_started" },
				{ offsetMin: 5, kind: "commit", sha: "not-a-sha" },
			],
		});

		await expect(writeSessionLog({ projectRoot, session, now: NOW })).rejects.toThrow("Fixture event 2 (commit) fails the event schema");
		await expect(readdir(resolveRoot().root)).rejects.toThrow();
	});

	it("throws when an event is older than the one before it", async () => {
		const session = makeSession({
			events: [
				{ offsetMin: 5, kind: "session_started" },
				{ offsetMin: 9, kind: "prompt", text: "earlier" },
			],
		});

		await expect(writeSessionLog({ projectRoot, session, now: NOW })).rejects.toThrow("offsets must not increase");
	});

	it("throws on a session with no events", async () => {
		await expect(writeSessionLog({ projectRoot, session: { pid: "live", events: [] }, now: NOW })).rejects.toThrow(
			"at least one event",
		);
	});
});
