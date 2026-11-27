import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import resolveEndedMark from "@/util/runtimePaths/resolveEndedMark/index.js";
import resolvePresenceFile from "@/util/runtimePaths/resolvePresenceFile/index.js";
import markClosed from "./index.js";

const KEY = "alpha-3f9a2c";
const A = "20261125T090000000Z-aaaaaa";
const B = "20261125T091000000Z-bbbbbb";
const CALLER = "20261125T100000000Z-cccccc";

let appData: string;

async function putPresence(claudeSessionId: string, overrides: Record<string, unknown> = {}): Promise<void> {
	const file = resolvePresenceFile({ projectKey: KEY, claudeSessionId });
	await mkdir(path.dirname(file), { recursive: true });
	await writeFile(
		file,
		JSON.stringify({
			v: 1,
			claudeSessionId,
			state: "working",
			at: "2026-11-25T09:05:00.000Z",
			hookEvent: "PostToolUse",
			...overrides,
		}),
	);
}

async function putMark(id: string): Promise<void> {
	const file = resolveEndedMark({ projectKey: KEY, id });
	await mkdir(path.dirname(file), { recursive: true });
	await writeFile(file, JSON.stringify({ v: 1, endedAt: "2026-11-25T09:30:00.000Z", endedBy: "hook", sessionId: id }));
}

async function readMark(id: string): Promise<Record<string, unknown>> {
	return JSON.parse(await readFile(resolveEndedMark({ projectKey: KEY, id }), "utf-8"));
}

beforeEach(async () => {
	appData = await mkdtemp(path.join(tmpdir(), "aide-mark-closed-"));
	vi.stubEnv("AIDEMD_HOME", path.join(appData, "aidemd"));
});

afterEach(async () => {
	vi.unstubAllEnvs();
	await rm(appData, { recursive: true, force: true });
});

describe("markClosed", () => {
	it("writes a transcript mark once and answers exists the second time", async () => {
		await putPresence("claude-1", { sessionId: A });

		expect(await markClosed({ projectKey: KEY, id: A, bySessionId: CALLER })).toEqual({ outcome: "written", id: A });
		expect(await readMark(A)).toMatchObject({ v: 1, sessionId: A, endedBy: "transcript", bySessionId: CALLER });
		expect(await markClosed({ projectKey: KEY, id: A, bySessionId: CALLER })).toEqual({ outcome: "exists" });
	});

	it("creates the ended folder when the project has none", async () => {
		expect(await markClosed({ projectKey: KEY, id: A, bySessionId: CALLER })).toEqual({ outcome: "written", id: A });
		expect(await readMark(A)).toMatchObject({ sessionId: A, endedBy: "transcript" });
	});

	it("keys the mark by the greatest observer id of the conversation", async () => {
		await putPresence("claude-1", { sessionId: B, earlierSessionIds: [A] });

		expect(await markClosed({ projectKey: KEY, id: A, bySessionId: CALLER })).toEqual({ outcome: "written", id: B });
		expect((await readMark(B)).sessionId).toBe(B);
	});

	it("answers exists and writes nothing when an earlier session of the conversation has a mark", async () => {
		await putPresence("claude-1", { sessionId: B, earlierSessionIds: [A] });
		await putMark(A);

		expect(await markClosed({ projectKey: KEY, id: B, bySessionId: CALLER })).toEqual({ outcome: "exists" });
		await expect(readFile(resolveEndedMark({ projectKey: KEY, id: B }), "utf-8")).rejects.toThrow();
		expect((await readMark(A)).endedBy).toBe("hook");
	});

	it("keys an unlinked presence's mark by its Claude id", async () => {
		await putPresence("claude-9");

		expect(await markClosed({ projectKey: KEY, id: "claude-9", bySessionId: CALLER })).toEqual({
			outcome: "written",
			id: "claude-9",
		});
		expect(await readMark("claude-9")).toMatchObject({ claudeSessionId: "claude-9", endedBy: "transcript", bySessionId: CALLER });
	});
});
