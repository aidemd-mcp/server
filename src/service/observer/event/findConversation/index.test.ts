import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdir, mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import resolveArchivedLog from "@/util/runtimePaths/resolveArchivedLog/index.js";
import resolveEndedMark from "@/util/runtimePaths/resolveEndedMark/index.js";
import resolvePresenceFile from "@/util/runtimePaths/resolvePresenceFile/index.js";
import resolveSessionLog from "@/util/runtimePaths/resolveSessionLog/index.js";
import findConversation from "./index.js";

const KEY = "alpha-3f9a2c";
const A = "20261125T090000000Z-aaaaaa";
const B = "20261125T091000000Z-bbbbbb";
const X = "20261125T093000000Z-eeeeee";
const OLD = "20261125T080000000Z-dddddd";
const A_START = Date.UTC(2026, 10, 25, 9, 0, 0, 0);

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

async function putMark(id: string, fields: Record<string, unknown> = {}): Promise<void> {
	const file = resolveEndedMark({ projectKey: KEY, id });
	await mkdir(path.dirname(file), { recursive: true });
	await writeFile(file, JSON.stringify({ v: 1, endedAt: "2026-11-25T09:30:00.000Z", endedBy: "hook", sessionId: id, ...fields }));
}

async function putLog(file: string): Promise<void> {
	await mkdir(path.dirname(file), { recursive: true });
	await writeFile(file, "");
}

beforeEach(async () => {
	appData = await mkdtemp(path.join(tmpdir(), "aide-find-conversation-"));
	vi.stubEnv("AIDEMD_HOME", path.join(appData, "aidemd"));
});

afterEach(async () => {
	vi.unstubAllEnvs();
	await rm(appData, { recursive: true, force: true });
});

describe("findConversation", () => {
	it("makes a conversation of one of a caller with no presence: no mark, not newer", async () => {
		const conversation = await findConversation({ projectKey: KEY, sessionId: B });

		expect(conversation).toEqual({
			sessionIds: [B],
			claudeSessionIds: [],
			mark: null,
			startedAt: Date.UTC(2026, 10, 25, 9, 10, 0, 0),
			newer: false,
		});
	});

	it("finds a resumed caller's earlier session, its mark and the earlier session's start", async () => {
		await putPresence("claude-1", { sessionId: B, earlierSessionIds: [A] });
		await putMark(A);
		await putLog(resolveSessionLog({ projectKey: KEY, sessionId: A }));
		await putLog(resolveSessionLog({ projectKey: KEY, sessionId: B }));

		const conversation = await findConversation({ projectKey: KEY, sessionId: B });

		expect(conversation).toMatchObject({
			sessionIds: [A, B],
			claudeSessionIds: ["claude-1"],
			mark: { endedBy: "hook" },
			startedAt: A_START,
			newer: false,
		});
	});

	it("is newer when a later session, archived or not, exists outside the conversation", async () => {
		await putPresence("claude-1", { sessionId: B, earlierSessionIds: [A] });
		await putMark(A);
		await putLog(resolveArchivedLog({ projectKey: KEY, sessionId: X }));

		expect((await findConversation({ projectKey: KEY, sessionId: B })).newer).toBe(true);
	});

	it("is not newer when the other session is older than the conversation's start", async () => {
		await putPresence("claude-1", { sessionId: B, earlierSessionIds: [A] });
		await putMark(A);
		await putLog(resolveSessionLog({ projectKey: KEY, sessionId: OLD }));

		expect((await findConversation({ projectKey: KEY, sessionId: B })).newer).toBe(false);
	});

	it("is newer when an unlinked presence was active after the conversation started", async () => {
		await putPresence("claude-1", { sessionId: B, earlierSessionIds: [A] });
		await putMark(A);
		await putPresence("claude-9", { at: "2026-11-25T09:45:00.000Z" });

		expect((await findConversation({ projectKey: KEY, sessionId: B })).newer).toBe(true);
	});

	it("is not newer for an unlinked presence that was active before the conversation started", async () => {
		await putPresence("claude-1", { sessionId: B, earlierSessionIds: [A] });
		await putMark(A);
		await putPresence("claude-9", { at: "2026-11-25T08:45:00.000Z" });

		expect((await findConversation({ projectKey: KEY, sessionId: B })).newer).toBe(false);
	});

	it("does not list the logs for a caller with no mark", async () => {
		await putPresence("claude-1", { sessionId: B, earlierSessionIds: [A] });
		await putLog(resolveSessionLog({ projectKey: KEY, sessionId: X }));
		const events = path.dirname(resolveSessionLog({ projectKey: KEY, sessionId: X }));
		await rm(events, { recursive: true });
		await writeFile(events, "a file where the events folder would be");

		const conversation = await findConversation({ projectKey: KEY, sessionId: B });

		expect(conversation.mark).toBeNull();
		expect(conversation.newer).toBe(false);
	});

	it("writes nothing", async () => {
		await putPresence("claude-1", { sessionId: B, earlierSessionIds: [A] });
		await putMark(A);
		const before = await readdir(appData, { recursive: true });

		await findConversation({ projectKey: KEY, sessionId: B });

		expect(await readdir(appData, { recursive: true })).toEqual(before);
	});
});
