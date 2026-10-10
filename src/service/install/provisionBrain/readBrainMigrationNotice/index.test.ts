import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, mkdir, writeFile, readFile, rm } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import readBrainMigrationNotice from "./index.js";
import obsidianBrainAideTemplate from "../obsidianBrainAideTemplate/index.js";

const fixtureDir = join(dirname(fileURLToPath(import.meta.url)), "..", "detectBrainMigration", "__fixtures__");
let projectRoot: string;
let filePath: string;

beforeEach(async () => {
	projectRoot = await mkdtemp(join(tmpdir(), "aide-brain-notice-"));
	filePath = join(projectRoot, ".aide", "config", "brain.aide");
});

afterEach(async () => {
	await rm(projectRoot, { recursive: true, force: true });
});

async function writeBrainAide(content: string): Promise<void> {
	await mkdir(join(projectRoot, ".aide", "config"), { recursive: true });
	await writeFile(filePath, content, "utf-8");
}

describe("readBrainMigrationNotice", () => {
	it("absent brain.aide returns null", async () => {
		expect(await readBrainMigrationNotice(projectRoot)).toBeNull();
	});

	it("v0.9.0 fixture returns marker names and launcher reasons only, file untouched", async () => {
		const fixture = await readFile(join(fixtureDir, "v0.9.0-brain.txt"), "utf-8");
		await writeBrainAide(fixture);

		expect(await readBrainMigrationNotice(projectRoot)).toEqual({
			staleSections: ["orientation", "config"],
			legacyLauncher: ["unpinned", "missing-auto-confirm"],
		});
		expect(await readFile(filePath, "utf-8")).toBe(fixture);
	});

	it("repo fixture returns stale sections and a null launcher, file untouched", async () => {
		const fixture = await readFile(join(fixtureDir, "aidemd-repo-2026-10-09-brain.txt"), "utf-8");
		await writeBrainAide(fixture);

		expect(await readBrainMigrationNotice(projectRoot)).toEqual({
			staleSections: [
			"orientation",
			"config",
			"update-playbook",
			// The repo copy predates the "card" → "task" rename, so its kanban sections are outdated too.
			"kanban-index",
			"kanban-create",
			"kanban-work",
			"kanban-manage",
			"kanban-move",
			"kanban-complete",
			"kanban-stash",
			"kanban-review",
		],
			legacyLauncher: null,
		});
		expect(await readFile(filePath, "utf-8")).toBe(fixture);
	});

	it("current template (local) returns null, file untouched", async () => {
		const template = obsidianBrainAideTemplate("local");
		await writeBrainAide(template);

		expect(await readBrainMigrationNotice(projectRoot)).toBeNull();
		expect(await readFile(filePath, "utf-8")).toBe(template);
	});

	it("malformed file returns null, file untouched", async () => {
		await writeBrainAide("arbitrary content");

		expect(await readBrainMigrationNotice(projectRoot)).toBeNull();
		expect(await readFile(filePath, "utf-8")).toBe("arbitrary content");
	});
});
