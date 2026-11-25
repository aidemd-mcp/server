import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdir, mkdtemp, rm, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import resolveEndedMark from "@/util/runtimePaths/resolveEndedMark/index.js";
import type { Presence } from "@/service/observer/event/shared/presenceRecord/index.js";
import judgeEntry from "./index.js";

const KEY = "alpha-3f9a2c";
const ID = "claude-aaaa";
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

beforeEach(async () => {
	appData = await mkdtemp(path.join(tmpdir(), "aide-judge-entry-"));
	vi.stubEnv("AIDEMD_HOME", path.join(appData, "aidemd"));
});

afterEach(async () => {
	vi.unstubAllEnvs();
	await rm(appData, { recursive: true, force: true });
});

describe("judgeEntry", () => {
	it("counts the presence's transcript write as activity", async () => {
		const transcript = path.join(appData, "transcript.jsonl");
		await writeFile(transcript, "", "utf-8");
		const written = new Date("2026-11-25T11:58:00.000Z");
		await utimes(transcript, written, written);

		const liveness = await judgeEntry({
			projectKey: KEY,
			markId: ID,
			events: [],
			presence: makePresence({ transcriptPath: transcript }),
			now: NOW,
		});

		expect(liveness.lastActivityAt).toBe(written.toISOString());
		expect(liveness.quietMinutes).toBe(2);
	});

	it("honours the ended mark kept under the mark id", async () => {
		const file = resolveEndedMark({ projectKey: KEY, id: ID });
		await mkdir(path.dirname(file), { recursive: true });
		await writeFile(
			file,
			JSON.stringify({ v: 1, claudeSessionId: ID, endedAt: "2026-11-25T11:55:00.000Z", endedBy: "user" }),
		);

		const liveness = await judgeEntry({ projectKey: KEY, markId: ID, events: [], presence: makePresence(), now: NOW });

		expect(liveness).toMatchObject({ state: "ended", endedBy: "user" });
	});

	it("treats a missing transcript and a missing mark as absent", async () => {
		const liveness = await judgeEntry({
			projectKey: KEY,
			markId: ID,
			events: [],
			presence: makePresence({ transcriptPath: path.join(appData, "gone.jsonl") }),
			now: NOW,
		});

		expect(liveness.state).toBe("working");
		expect(liveness.lastActivityAt).toBe("2026-11-25T11:50:00.000Z");
	});
});
