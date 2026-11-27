import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import resolve from "@/util/runtimePaths/resolve/index.js";
import resolveEndedMark from "@/util/runtimePaths/resolveEndedMark/index.js";
import resolvePresenceFile from "@/util/runtimePaths/resolvePresenceFile/index.js";
import readPreviouslyEnded from "./index.js";

const A = "20261125T090000000Z-aaaaaa";
const B = "20261125T091000000Z-bbbbbb";

let appData: string;
let project: string;
let projectKey: string;

async function putMark(id: string): Promise<void> {
	const file = resolveEndedMark({ projectKey, id });
	await mkdir(path.dirname(file), { recursive: true });
	await writeFile(file, JSON.stringify({ v: 1, endedAt: "2026-11-25T09:30:00.000Z", endedBy: "hook", sessionId: id }));
}

async function putPresence(overrides: Record<string, unknown>): Promise<void> {
	const file = resolvePresenceFile({ projectKey, claudeSessionId: "claude-1" });
	await mkdir(path.dirname(file), { recursive: true });
	await writeFile(
		file,
		JSON.stringify({
			v: 1,
			claudeSessionId: "claude-1",
			state: "working",
			at: "2026-11-25T09:05:00.000Z",
			hookEvent: "PostToolUse",
			...overrides,
		}),
	);
}

beforeEach(async () => {
	appData = await mkdtemp(path.join(tmpdir(), "aide-prev-ended-appdata-"));
	project = await mkdtemp(path.join(tmpdir(), "aide-prev-ended-project-"));
	vi.stubEnv("AIDEMD_HOME", path.join(appData, "aidemd"));
	projectKey = resolve({ projectRoot: project }).projectKey;
});

afterEach(async () => {
	vi.unstubAllEnvs();
	await Promise.all([appData, project].map((folder) => rm(folder, { recursive: true, force: true })));
});

describe("readPreviouslyEnded", () => {
	it("is false with no mark and no presence", async () => {
		expect(await readPreviouslyEnded({ projectRoot: project, sessionId: B })).toBe(false);
	});

	it("is true when the session itself carries a mark", async () => {
		await putMark(B);

		expect(await readPreviouslyEnded({ projectRoot: project, sessionId: B })).toBe(true);
	});

	it("is true when an earlier observer session of the same conversation carries a mark", async () => {
		await putPresence({ sessionId: B, earlierSessionIds: [A] });
		await putMark(A);

		expect(await readPreviouslyEnded({ projectRoot: project, sessionId: B })).toBe(true);
	});

	it("is false when only an unrelated session carries a mark", async () => {
		await putMark(A);

		expect(await readPreviouslyEnded({ projectRoot: project, sessionId: B })).toBe(false);
	});

	it("is false and does not throw for a project root that cannot be resolved", async () => {
		expect(await readPreviouslyEnded({ projectRoot: "relative/path", sessionId: B })).toBe(false);
	});
});
