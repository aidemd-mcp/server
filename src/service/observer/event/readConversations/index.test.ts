import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import resolvePresenceFile from "@/util/runtimePaths/resolvePresenceFile/index.js";
import readConversations from "./index.js";

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
			at: "2026-11-25T11:50:00.000Z",
			hookEvent: "PostToolUse",
			...overrides,
		}),
	);
}

beforeEach(async () => {
	appData = await mkdtemp(path.join(tmpdir(), "aide-read-conversations-"));
	vi.stubEnv("AIDEMD_HOME", path.join(appData, "aidemd"));
});

afterEach(async () => {
	vi.unstubAllEnvs();
	await rm(appData, { recursive: true, force: true });
});

describe("readConversations", () => {
	it("answers [] when the project has no presence", async () => {
		expect(await readConversations({ projectKey: KEY })).toEqual([]);
	});

	it("counts a resumed conversation once, with every observer and Claude id, and drops the presences", async () => {
		await putPresence("claude-1", { sessionId: B, earlierSessionIds: [A] });
		await putPresence("claude-2", { sessionId: B });

		expect(await readConversations({ projectKey: KEY })).toEqual([
			{ sessionIds: [A, B], claudeSessionIds: ["claude-1", "claude-2"] },
		]);
	});

	it("lists an unlinked presence as a conversation with no observer id", async () => {
		await putPresence("claude-3");

		expect(await readConversations({ projectKey: KEY })).toEqual([{ sessionIds: [], claudeSessionIds: ["claude-3"] }]);
	});

	it("counts an unreadable presence folder as none", async () => {
		const file = resolvePresenceFile({ projectKey: KEY, claudeSessionId: "probe" });
		await mkdir(path.dirname(path.dirname(file)), { recursive: true });
		await writeFile(path.dirname(file), "not a folder");

		expect(await readConversations({ projectKey: KEY })).toEqual([]);
	});
});
