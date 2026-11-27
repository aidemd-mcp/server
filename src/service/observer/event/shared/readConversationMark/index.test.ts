import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import resolveEndedMark from "@/util/runtimePaths/resolveEndedMark/index.js";
import readConversationMark from "./index.js";

const KEY = "alpha-3f9a2c";
const A = "20261125T090000000Z-aaaaaa";
const B = "20261125T091000000Z-bbbbbb";

let appData: string;

async function putMark(id: string, fields: Record<string, unknown>): Promise<void> {
	const file = resolveEndedMark({ projectKey: KEY, id });
	await mkdir(path.dirname(file), { recursive: true });
	await writeFile(file, JSON.stringify({ v: 1, endedAt: "2026-11-25T11:55:00.000Z", endedBy: "hook", ...fields }));
}

beforeEach(async () => {
	appData = await mkdtemp(path.join(tmpdir(), "aide-conversation-mark-"));
	vi.stubEnv("AIDEMD_HOME", path.join(appData, "aidemd"));
});

afterEach(async () => {
	vi.unstubAllEnvs();
	await rm(appData, { recursive: true, force: true });
});

describe("readConversationMark", () => {
	it("answers null when no id of the conversation has a mark", async () => {
		const conversation = { sessionIds: [A, B], claudeSessionIds: ["claude-1"] };

		expect(await readConversationMark({ projectKey: KEY, conversation })).toBeNull();
	});

	it("finds a mark kept under an earlier observer session", async () => {
		await putMark(A, { sessionId: A });

		const mark = await readConversationMark({
			projectKey: KEY,
			conversation: { sessionIds: [A, B], claudeSessionIds: ["claude-1"] },
		});

		expect(mark).toMatchObject({ sessionId: A, endedBy: "hook" });
	});

	it("finds a mark kept under a Claude session id", async () => {
		await putMark("claude-1", { claudeSessionId: "claude-1" });

		const mark = await readConversationMark({
			projectKey: KEY,
			conversation: { sessionIds: [], claudeSessionIds: ["claude-1"] },
		});

		expect(mark).toMatchObject({ claudeSessionId: "claude-1" });
	});

	it("lets a user mark on one session beat a newer hook mark on another", async () => {
		await putMark(A, { sessionId: A, endedBy: "user", endedAt: "2026-11-25T11:00:00.000Z" });
		await putMark(B, { sessionId: B, endedBy: "hook", endedAt: "2026-11-25T11:30:00.000Z" });

		const mark = await readConversationMark({
			projectKey: KEY,
			conversation: { sessionIds: [A, B], claudeSessionIds: [] },
		});

		expect(mark?.endedBy).toBe("user");
	});

	it("treats a malformed mark as absent", async () => {
		const file = resolveEndedMark({ projectKey: KEY, id: A });
		await mkdir(path.dirname(file), { recursive: true });
		await writeFile(file, "{not json");

		const conversation = { sessionIds: [A], claudeSessionIds: [] };

		expect(await readConversationMark({ projectKey: KEY, conversation })).toBeNull();
	});
});
