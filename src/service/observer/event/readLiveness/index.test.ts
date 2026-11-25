import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import resolveEndedMark from "@/util/runtimePaths/resolveEndedMark/index.js";
import resolvePresenceFile from "@/util/runtimePaths/resolvePresenceFile/index.js";
import type { ObserverEvent } from "@/service/observer/event/shared/schema/index.js";
import readLiveness from "./index.js";

const KEY = "alpha-3f9a2c";
const SESSION_A = "20261125T090000000Z-aaaaaa";
const SESSION_B = "20261125T091000000Z-bbbbbb";
const SESSION_OTHER = "20261125T092000000Z-cccccc";
const NOW = Date.parse("2026-11-25T12:00:00.000Z");

let appData: string;

function makeEvent(sessionId: string, ts: string): ObserverEvent {
	return { v: 2, ts, sessionId, seq: 1, pid: 1, kind: "release", version: "1.0.0" } as ObserverEvent;
}

async function putPresence(claudeSessionId: string, fields: Record<string, unknown> = {}): Promise<void> {
	const file = resolvePresenceFile({ projectKey: KEY, claudeSessionId });
	await mkdir(path.dirname(file), { recursive: true });
	await writeFile(
		file,
		JSON.stringify({
			v: 1,
			claudeSessionId,
			state: "working",
			at: "2026-11-25T11:50:00.000Z",
			hookEvent: "PostToolUse",
			...fields,
		}),
	);
}

async function putMark(id: string, fields: Record<string, unknown>): Promise<void> {
	const file = resolveEndedMark({ projectKey: KEY, id });
	await mkdir(path.dirname(file), { recursive: true });
	await writeFile(file, JSON.stringify({ v: 1, endedAt: "2026-11-25T11:55:00.000Z", endedBy: "user", ...fields }));
}

function ask(...sessionIds: string[]): { sessionId: string; events: ObserverEvent[] }[] {
	return sessionIds.map((sessionId) => ({ sessionId, events: [] }));
}

beforeEach(async () => {
	appData = await mkdtemp(path.join(tmpdir(), "aide-read-liveness-"));
	vi.stubEnv("LOCALAPPDATA", appData);
	vi.stubEnv("XDG_STATE_HOME", appData);
});

afterEach(async () => {
	vi.unstubAllEnvs();
	await rm(appData, { recursive: true, force: true });
});

describe("readLiveness", () => {
	it("judges a session with no presence and no mark as working, and reports no unlinked", async () => {
		const events = [makeEvent(SESSION_A, "2026-11-25T11:00:00.000Z")];

		const report = await readLiveness({ projectKey: KEY, sessions: [{ sessionId: SESSION_A, events }], now: NOW });

		expect(report.sessions[SESSION_A]).toMatchObject({ state: "working", maybeStuck: true, quietMinutes: 60 });
		expect(report.unlinked).toEqual([]);
	});

	it("reads a Stop presence linked to the session as waiting", async () => {
		await putPresence("claude-aaaa", { sessionId: SESSION_A, state: "waiting", hookEvent: "Stop" });

		const report = await readLiveness({ projectKey: KEY, sessions: ask(SESSION_A), now: NOW });

		expect(report.sessions[SESSION_A]).toMatchObject({ state: "waiting", quietMinutes: 10, maybeStuck: false });
	});

	it("lets the newest `at` of two presences linked to one session win", async () => {
		await putPresence("claude-old", { sessionId: SESSION_A, state: "working", at: "2026-11-25T11:00:00.000Z" });
		await putPresence("claude-new", {
			sessionId: SESSION_A,
			state: "waiting",
			at: "2026-11-25T11:30:00.000Z",
			hookEvent: "Stop",
		});

		const report = await readLiveness({ projectKey: KEY, sessions: ask(SESSION_A), now: NOW });

		expect(report.sessions[SESSION_A].state).toBe("waiting");
	});

	it("honours an ended mark over a working presence", async () => {
		await putPresence("claude-aaaa", { sessionId: SESSION_A });
		await putMark(SESSION_A, { sessionId: SESSION_A, endedBy: "user", bySessionId: SESSION_B });

		const report = await readLiveness({ projectKey: KEY, sessions: ask(SESSION_A), now: NOW });

		expect(report.sessions[SESSION_A]).toMatchObject({ state: "ended", endedBy: "user" });
	});

	it("judges each asked session on its own presence and mark", async () => {
		await putPresence("claude-aaaa", { sessionId: SESSION_A });
		await putMark(SESSION_B, { sessionId: SESSION_B });

		const report = await readLiveness({ projectKey: KEY, sessions: ask(SESSION_A, SESSION_B), now: NOW });

		expect(report.sessions[SESSION_A].state).toBe("working");
		expect(report.sessions[SESSION_B].state).toBe("ended");
	});

	it("lists an unlinked presence and honours the mark kept under its Claude id", async () => {
		await putPresence("claude-open");
		await putPresence("claude-closed");
		await putMark("claude-closed", { claudeSessionId: "claude-closed" });

		const report = await readLiveness({ projectKey: KEY, sessions: [], now: NOW });

		const byId = Object.fromEntries(report.unlinked.map((entry) => [entry.claudeSessionId, entry.liveness]));
		expect(Object.keys(byId).sort()).toEqual(["claude-closed", "claude-open"]);
		expect(byId["claude-open"]).toMatchObject({ state: "working", quietMinutes: 10 });
		expect(byId["claude-closed"]).toMatchObject({ state: "ended", endedBy: "user" });
	});

	it("puts a presence linked to a session that was not asked about in neither list", async () => {
		await putPresence("claude-zzzz", { sessionId: SESSION_OTHER });

		const report = await readLiveness({ projectKey: KEY, sessions: ask(SESSION_A), now: NOW });

		expect(Object.keys(report.sessions)).toEqual([SESSION_A]);
		expect(report.unlinked).toEqual([]);
	});

	it("skips a malformed presence file without failing the report", async () => {
		await putPresence("claude-aaaa", { sessionId: SESSION_A });
		await writeFile(resolvePresenceFile({ projectKey: KEY, claudeSessionId: "claude-bad" }), "{not json");

		const report = await readLiveness({ projectKey: KEY, sessions: ask(SESSION_A), now: NOW });

		expect(report.sessions[SESSION_A].state).toBe("working");
		expect(report.unlinked).toEqual([]);
	});

	it("answers working for a session of a project with no presence folder at all", async () => {
		const report = await readLiveness({ projectKey: KEY, sessions: ask(SESSION_A), now: NOW });

		expect(report.sessions[SESSION_A]).toMatchObject({ state: "working", lastActivityAt: null });
	});
});
