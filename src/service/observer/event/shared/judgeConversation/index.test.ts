import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdir, mkdtemp, readdir, rm, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import resolveEndedMark from "@/util/runtimePaths/resolveEndedMark/index.js";
import type { Presence } from "@/service/observer/event/shared/presenceRecord/index.js";
import type { Conversation } from "@/service/observer/event/types/index.js";
import judgeConversation from "./index.js";

const KEY = "alpha-3f9a2c";
const ID = "claude-aaaa";
const SESSION_A = "20261125T090000000Z-aaaaaa";
const SESSION_B = "20261125T091000000Z-bbbbbb";
const NOW = Date.parse("2026-11-25T12:00:00.000Z");

let appData: string;

function makePresence(overrides: Partial<Presence> = {}): Presence {
	return {
		v: 1,
		claudeSessionId: ID,
		state: "working",
		at: "2026-11-25T11:50:00.000Z",
		hookEvent: "PostToolUse",
		...overrides,
	};
}

function makeConversation(presence: Presence | null, sessionIds: string[] = []): Conversation {
	return {
		sessionIds,
		claudeSessionIds: presence === null ? [] : [presence.claudeSessionId],
		presences: presence === null ? [] : [presence],
	};
}

async function putMark(id: string, fields: Record<string, unknown>): Promise<void> {
	const file = resolveEndedMark({ projectKey: KEY, id });
	await mkdir(path.dirname(file), { recursive: true });
	await writeFile(file, JSON.stringify({ v: 1, endedAt: "2026-11-25T11:55:00.000Z", endedBy: "user", ...fields }));
}

beforeEach(async () => {
	appData = await mkdtemp(path.join(tmpdir(), "aide-judge-conversation-"));
	vi.stubEnv("AIDEMD_HOME", path.join(appData, "aidemd"));
});

afterEach(async () => {
	vi.unstubAllEnvs();
	await rm(appData, { recursive: true, force: true });
});

describe("judgeConversation", () => {
	it("counts the newest presence's transcript write as activity", async () => {
		const transcript = path.join(appData, "transcript.jsonl");
		await writeFile(transcript, "", "utf-8");
		const written = new Date("2026-11-25T11:58:00.000Z");
		await utimes(transcript, written, written);

		const liveness = await judgeConversation({
			projectKey: KEY,
			conversation: makeConversation(makePresence({ transcriptPath: transcript })),
			events: [],
			now: NOW,
		});

		expect(liveness.lastActivityAt).toBe(written.toISOString());
		expect(liveness.quietMinutes).toBe(2);
	});

	it("honours the ended mark kept under the Claude session id", async () => {
		await putMark(ID, { claudeSessionId: ID });

		const liveness = await judgeConversation({
			projectKey: KEY,
			conversation: makeConversation(makePresence()),
			events: [],
			now: NOW,
		});

		expect(liveness).toMatchObject({ state: "ended", endedBy: "user" });
	});

	it("ends the whole conversation when a mark sits on an earlier observer session", async () => {
		await putMark(SESSION_A, { sessionId: SESSION_A, endedBy: "hook" });

		const liveness = await judgeConversation({
			projectKey: KEY,
			conversation: makeConversation(makePresence({ sessionId: SESSION_B, earlierSessionIds: [SESSION_A] }), [
				SESSION_A,
				SESSION_B,
			]),
			events: [],
			now: NOW,
		});

		expect(liveness).toMatchObject({ state: "ended", endedBy: "hook" });
	});

	it("lets the presence with the newest `at` of two Claude ids speak", async () => {
		const older = makePresence({ claudeSessionId: "claude-old", state: "working", at: "2026-11-25T11:00:00.000Z" });
		const newer = makePresence({
			claudeSessionId: "claude-new",
			state: "waiting",
			at: "2026-11-25T11:30:00.000Z",
			hookEvent: "Stop",
		});

		const liveness = await judgeConversation({
			projectKey: KEY,
			conversation: { sessionIds: [SESSION_A], claudeSessionIds: ["claude-new", "claude-old"], presences: [older, newer] },
			events: [],
			now: NOW,
		});

		expect(liveness.state).toBe("waiting");
	});

	it("judges a presence whose transcript ends in its own closing record as ended from the transcript, writing nothing", async () => {
		const transcript = path.join(appData, "transcript.jsonl");
		await writeFile(
			transcript,
			`${JSON.stringify({ type: "user", sessionId: ID })}\n${JSON.stringify({ type: "cost-state", sessionId: ID })}\n`,
		);
		const filesBefore = await readdir(appData, { recursive: true });

		const liveness = await judgeConversation({
			projectKey: KEY,
			conversation: makeConversation(makePresence({ transcriptPath: transcript })),
			events: [],
			now: NOW,
		});

		expect(liveness).toMatchObject({ state: "ended", endedBy: "transcript" });
		expect(await readdir(appData, { recursive: true })).toEqual(filesBefore);
	});

	it("treats a missing transcript and a missing mark as absent", async () => {
		const liveness = await judgeConversation({
			projectKey: KEY,
			conversation: makeConversation(makePresence({ transcriptPath: path.join(appData, "gone.jsonl") })),
			events: [],
			now: NOW,
		});

		expect(liveness.state).toBe("working");
		expect(liveness.lastActivityAt).toBe("2026-11-25T11:50:00.000Z");
	});

	it("judges a conversation with no presence as working", async () => {
		const liveness = await judgeConversation({
			projectKey: KEY,
			conversation: { sessionIds: [SESSION_A], claudeSessionIds: [], presences: [] },
			events: [],
			now: NOW,
		});

		expect(liveness).toMatchObject({ state: "working", lastActivityAt: null });
	});
});
