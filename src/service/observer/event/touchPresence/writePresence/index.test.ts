import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdir, mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import writePresence from "./index.js";
import type { Presence } from "@/service/observer/event/shared/presenceRecord/index.js";

let folder: string;

function makePresence(overrides: Partial<Presence> = {}): Presence {
	return {
		v: 1,
		claudeSessionId: "claude-aaaa",
		state: "working",
		at: "2026-11-25T10:00:00.000Z",
		hookEvent: "PostToolUse",
		...overrides,
	};
}

beforeEach(async () => {
	folder = await mkdtemp(path.join(tmpdir(), "aide-write-presence-"));
});

afterEach(async () => {
	await rm(folder, { recursive: true, force: true });
});

describe("writePresence", () => {
	it("writes the record and leaves no temp file behind", async () => {
		const file = path.join(folder, "claude-aaaa.json");

		await writePresence({ path: file, presence: makePresence() });

		expect(JSON.parse(await readFile(file, "utf-8"))).toEqual(makePresence());
		expect(await readdir(folder)).toEqual(["claude-aaaa.json"]);
	});

	it("replaces an existing record whole", async () => {
		const file = path.join(folder, "claude-aaaa.json");
		await writePresence({ path: file, presence: makePresence({ transcriptPath: "/t/a.jsonl" }) });

		await writePresence({ path: file, presence: makePresence({ state: "waiting", hookEvent: "Stop" }) });

		const stored = JSON.parse(await readFile(file, "utf-8"));
		expect(stored.state).toBe("waiting");
		expect(stored).not.toHaveProperty("transcriptPath");
	});

	it("removes the temp file and rethrows when the rename fails", async () => {
		const file = path.join(folder, "claude-aaaa.json");
		await mkdir(file); // a directory in the way makes the rename fail

		await expect(writePresence({ path: file, presence: makePresence() })).rejects.toThrow();

		expect(await readdir(folder)).toEqual(["claude-aaaa.json"]);
	});
});
