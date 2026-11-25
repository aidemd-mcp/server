import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import resolvePresenceFile from "@/util/runtimePaths/resolvePresenceFile/index.js";
import readPresence from "./index.js";

const KEY = "alpha-3f9a2c";
const CLAUDE_A = "claude-aaaa";
const CLAUDE_B = "claude-bbbb";

let appData: string;

function makePresence(claudeSessionId: string, overrides: Record<string, unknown> = {}): Record<string, unknown> {
	return {
		v: 1,
		claudeSessionId,
		state: "working",
		at: "2026-11-25T10:00:00.000Z",
		hookEvent: "UserPromptSubmit",
		...overrides,
	};
}

async function put(fileStem: string, content: string): Promise<void> {
	const file = resolvePresenceFile({ projectKey: KEY, claudeSessionId: fileStem });
	await mkdir(path.dirname(file), { recursive: true });
	await writeFile(file, content, "utf-8");
}

beforeEach(async () => {
	appData = await mkdtemp(path.join(tmpdir(), "aide-read-presence-"));
	vi.stubEnv("LOCALAPPDATA", appData);
	vi.stubEnv("XDG_STATE_HOME", appData);
});

afterEach(async () => {
	vi.unstubAllEnvs();
	await rm(appData, { recursive: true, force: true });
});

describe("readPresence", () => {
	it("round-trips every stored record", async () => {
		await put(CLAUDE_A, JSON.stringify(makePresence(CLAUDE_A)));
		await put(CLAUDE_B, JSON.stringify(makePresence(CLAUDE_B, { state: "waiting", hookEvent: "Stop" })));

		const records = await readPresence({ projectKey: KEY });

		expect(records.map((record) => record.claudeSessionId).sort()).toEqual([CLAUDE_A, CLAUDE_B]);
		expect(records.find((record) => record.claudeSessionId === CLAUDE_B)?.state).toBe("waiting");
	});

	it("answers [] when the project has no presence folder", async () => {
		expect(await readPresence({ projectKey: KEY })).toEqual([]);
	});

	it("answers [] for a string that is not a project key", async () => {
		expect(await readPresence({ projectKey: "../x" })).toEqual([]);
	});

	it("skips a malformed file and keeps the rest", async () => {
		await put(CLAUDE_A, "{broken");
		await put(CLAUDE_B, JSON.stringify(makePresence(CLAUDE_B)));

		const records = await readPresence({ projectKey: KEY });

		expect(records.map((record) => record.claudeSessionId)).toEqual([CLAUDE_B]);
	});

	it("skips a file that does not fit the schema", async () => {
		await put(CLAUDE_A, JSON.stringify(makePresence(CLAUDE_A, { state: "idle" })));

		expect(await readPresence({ projectKey: KEY })).toEqual([]);
	});

	it("skips a file whose claudeSessionId differs from its name", async () => {
		await put(CLAUDE_A, JSON.stringify(makePresence(CLAUDE_B)));

		expect(await readPresence({ projectKey: KEY })).toEqual([]);
	});

	it("skips files that are not .json records and stems that are not safe ids", async () => {
		const folder = path.dirname(resolvePresenceFile({ projectKey: KEY, claudeSessionId: CLAUDE_A }));
		await mkdir(folder, { recursive: true });
		await writeFile(path.join(folder, `${CLAUDE_A}.json.tmp`), JSON.stringify(makePresence(CLAUDE_A)), "utf-8");
		await writeFile(path.join(folder, ".hidden.json"), JSON.stringify(makePresence(".hidden")), "utf-8");

		expect(await readPresence({ projectKey: KEY })).toEqual([]);
	});
});
