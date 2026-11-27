import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import resolveEndedMark from "@/util/runtimePaths/resolveEndedMark/index.js";
import resolvePresenceFile from "@/util/runtimePaths/resolvePresenceFile/index.js";
import resolveSessionLog from "@/util/runtimePaths/resolveSessionLog/index.js";
import reopen from "./index.js";

const KEY = "alpha-3f9a2c";
const A = "20261125T090000000Z-aaaaaa";
const B = "20261125T091000000Z-bbbbbb";

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

async function putLog(sessionId: string): Promise<void> {
	const file = resolveSessionLog({ projectKey: KEY, sessionId });
	await mkdir(path.dirname(file), { recursive: true });
	await writeFile(file, `log of ${sessionId}\n`);
}

/** Every file's content outside the ended folder, keyed by path. */
async function snapshot(): Promise<Record<string, string>> {
	const entries = await readdir(appData, { recursive: true, withFileTypes: true });
	const files = entries.filter((entry) => entry.isFile() && path.basename(entry.parentPath) !== "ended");
	const pairs = await Promise.all(
		files.map(async (entry) => {
			const file = path.join(entry.parentPath, entry.name);
			return [file, await readFile(file, "utf-8")] as const;
		}),
	);
	return Object.fromEntries(pairs);
}

beforeEach(async () => {
	appData = await mkdtemp(path.join(tmpdir(), "aide-reopen-"));
	vi.stubEnv("AIDEMD_HOME", path.join(appData, "aidemd"));
});

afterEach(async () => {
	vi.unstubAllEnvs();
	await rm(appData, { recursive: true, force: true });
});

describe("reopen", () => {
	it("removes the marks of every session of the conversation and touches nothing else", async () => {
		await putPresence("claude-1", { sessionId: B, earlierSessionIds: [A] });
		await putLog(A);
		await putLog(B);
		await putMark(A);
		await putMark(B);
		const before = await snapshot();

		expect(await reopen({ projectKey: KEY, sessionId: B })).toEqual({ outcome: "reopened", cleared: 2 });

		expect(await snapshot()).toEqual(before);
		await expect(readFile(resolveEndedMark({ projectKey: KEY, id: A }), "utf-8")).rejects.toThrow();
		await expect(readFile(resolveEndedMark({ projectKey: KEY, id: B }), "utf-8")).rejects.toThrow();
	});

	it("clears a mark keyed by a Claude id of the conversation", async () => {
		await putPresence("claude-1", { sessionId: B });
		await putMark("claude-1");

		expect(await reopen({ projectKey: KEY, sessionId: B })).toEqual({ outcome: "reopened", cleared: 1 });
	});

	it("reopens with nothing cleared when no mark exists", async () => {
		expect(await reopen({ projectKey: KEY, sessionId: B })).toEqual({ outcome: "reopened", cleared: 0 });
	});

	it("reports failed when a mark cannot be removed, still removing the others", async () => {
		await putPresence("claude-1", { sessionId: B, earlierSessionIds: [A] });
		await putMark(B);
		await mkdir(resolveEndedMark({ projectKey: KEY, id: A }), { recursive: true });

		const outcome = await reopen({ projectKey: KEY, sessionId: B });

		expect(outcome.outcome).toBe("failed");
		await expect(readFile(resolveEndedMark({ projectKey: KEY, id: B }), "utf-8")).rejects.toThrow();
	});
});
