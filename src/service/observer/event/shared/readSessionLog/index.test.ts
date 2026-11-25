import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import readSessionLog from "@/service/observer/event/shared/readSessionLog/index.js";
import type { ObserverEvent } from "@/service/observer/event/shared/schema/index.js";

const SESSION_ID = "20261122T090000000Z-aaaaaa";
const NOW = Date.parse("2026-11-22T12:00:00.000Z");

function makeEvent(overrides: Record<string, unknown> = {}): ObserverEvent {
	return {
		v: 1,
		ts: new Date(NOW - 60 * 1000).toISOString(),
		sessionId: SESSION_ID,
		seq: 1,
		pid: 4242,
		kind: "release",
		version: "1.0.0",
		...overrides,
	} as ObserverEvent;
}

function toLines(events: unknown[]): string {
	return events.map((event) => JSON.stringify(event)).join("\n") + "\n";
}

describe("readSessionLog", () => {
	let folder: string;
	let path: string;

	beforeEach(async () => {
		vi.clearAllMocks();
		vi.useFakeTimers({ toFake: ["Date"] });
		vi.setSystemTime(NOW);
		folder = await mkdtemp(join(tmpdir(), "read-session-log-"));
		path = join(folder, `${SESSION_ID}.jsonl`);
	});

	afterEach(async () => {
		vi.useRealTimers();
		await rm(folder, { recursive: true, force: true });
	});

	it("returns null for a missing path", async () => {
		expect(await readSessionLog({ path, sessionId: SESSION_ID })).toBeNull();
	});

	it("returns session_started exactly as recorded, with nothing the agent did not send", async () => {
		const started = makeEvent({ seq: 1, kind: "session_started", version: undefined, kanbanTag: "aidemd-mcp" });
		await writeFile(path, toLines([started, makeEvent({ seq: 2 })]), "utf-8");

		const log = await readSessionLog({ path, sessionId: SESSION_ID });

		expect(log?.started).toEqual(started);
		expect(log?.started).not.toHaveProperty("projectRoot");
		expect(log?.started).not.toHaveProperty("brainPath");
		expect(log?.events).toHaveLength(2);
		expect(log?.unreadable).toBe(false);
	});

	it("returns started null and still returns events when the agent never reported a start", async () => {
		await writeFile(path, toLines([makeEvent({ seq: 1 }), makeEvent({ seq: 2 })]), "utf-8");

		const log = await readSessionLog({ path, sessionId: SESSION_ID });

		expect(log?.started).toBeNull();
		expect(log?.events.map((event) => event.seq)).toEqual([1, 2]);
	});

	it("skips and counts a malformed line", async () => {
		const content = `${JSON.stringify(makeEvent({ seq: 1 }))}\n{not json\n${JSON.stringify(makeEvent({ seq: 2 }))}\n`;
		await writeFile(path, content, "utf-8");

		const log = await readSessionLog({ path, sessionId: SESSION_ID });

		expect(log?.events).toHaveLength(2);
		expect(log?.skippedLines).toBe(1);
	});

	it("judges no liveness: the raw log carries events and no liveness field", async () => {
		await writeFile(path, toLines([makeEvent({ seq: 1 })]), "utf-8");

		const log = await readSessionLog({ path, sessionId: SESSION_ID });

		expect(log).not.toHaveProperty("liveness");
		expect(log).not.toHaveProperty("live");
		expect(log?.events).toHaveLength(1);
	});

	it("marks a path that cannot be read as unreadable", async () => {
		await mkdir(path);

		const log = await readSessionLog({ path, sessionId: SESSION_ID });

		expect(log).toEqual({
			sessionId: SESSION_ID,
			started: null,
			events: [],
			skippedLines: 0,
			unreadable: true,
		});
	});
});
