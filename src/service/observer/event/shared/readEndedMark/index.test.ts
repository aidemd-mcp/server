import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import resolveEndedMark from "@/util/runtimePaths/resolveEndedMark/index.js";
import readEndedMark from "./index.js";

const KEY = "alpha-3f9a2c";
const SESSION = "20261125T100000000Z-abc123";
const MARK = { v: 1, sessionId: SESSION, endedAt: "2026-11-25T10:00:00.000Z", endedBy: "user", bySessionId: "other-1" };

let appData: string;

async function put(id: string, content: string): Promise<void> {
	const file = resolveEndedMark({ projectKey: KEY, id });
	await mkdir(path.dirname(file), { recursive: true });
	await writeFile(file, content, "utf-8");
}

beforeEach(async () => {
	appData = await mkdtemp(path.join(tmpdir(), "aide-read-ended-"));
	vi.stubEnv("AIDEMD_HOME", path.join(appData, "aidemd"));
});

afterEach(async () => {
	vi.unstubAllEnvs();
	await rm(appData, { recursive: true, force: true });
});

describe("readEndedMark", () => {
	it("round-trips a stored mark", async () => {
		await put(SESSION, JSON.stringify(MARK));

		expect(await readEndedMark({ projectKey: KEY, id: SESSION })).toEqual(MARK);
	});

	it("answers null when there is no folder or no file", async () => {
		expect(await readEndedMark({ projectKey: KEY, id: SESSION })).toBeNull();
	});

	it("answers null for a malformed file", async () => {
		await put(SESSION, "{not json");

		expect(await readEndedMark({ projectKey: KEY, id: SESSION })).toBeNull();
	});

	it("answers null for a file that does not fit the schema", async () => {
		await put(SESSION, JSON.stringify({ ...MARK, endedBy: "timer" }));

		expect(await readEndedMark({ projectKey: KEY, id: SESSION })).toBeNull();
	});

	it("answers null for an unsafe id or a bad project key instead of throwing", async () => {
		expect(await readEndedMark({ projectKey: KEY, id: "../escape" })).toBeNull();
		expect(await readEndedMark({ projectKey: "not a key", id: SESSION })).toBeNull();
	});
});
