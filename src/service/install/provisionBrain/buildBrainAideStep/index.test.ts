import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, mkdir, writeFile, readFile, rm } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import buildBrainAideStep from "./index.js";
import obsidianBrainAideTemplate from "../obsidianBrainAideTemplate/index.js";
import { parseBrainAideFromString } from "@/service/parseBrainAide/index.js";
import brainContract from "@/service/brainContract/index.js";
import toMarkerPair from "@/service/brainContract/toMarkerPair/index.js";

let projectRoot: string;

beforeEach(async () => {
	projectRoot = await mkdtemp(join(tmpdir(), "aide-build-brain-step-"));
});

afterEach(async () => {
	await rm(projectRoot, { recursive: true, force: true });
});

async function writeBrainAide(content: string): Promise<void> {
	await mkdir(join(projectRoot, ".aide", "config"), { recursive: true });
	await writeFile(join(projectRoot, ".aide", "config", "brain.aide"), content, "utf-8");
}

const kanbanTail = brainContract
	.slice(brainContract.findIndex((entry) => entry.marker === "kanban-index"))
	.map((entry) => entry.marker);

describe("buildBrainAideStep", () => {
	it("absent file: would-create with template content and the contract", async () => {
		const step = await buildBrainAideStep(projectRoot);

		expect(step.name).toBe("Brain config (brain.aide)");
		expect(step.status).toBe("would-create");
		expect(step.content).toBe(obsidianBrainAideTemplate());
		expect(step.brainContract).toEqual(brainContract);
		expect(step.brainRepair).toBeUndefined();
	});

	it("outdated file: exists with brainRepair, no content, and the contract", async () => {
		const full = obsidianBrainAideTemplate();
		const cutAt = full.indexOf(toMarkerPair("kanban-index").open);
		await writeBrainAide(full.slice(0, cutAt));

		const step = await buildBrainAideStep(projectRoot);

		expect(step.status).toBe("exists");
		expect(step.content).toBeUndefined();
		expect(step.brainContract).toEqual(brainContract);
		expect(step.brainRepair?.map((r) => r.marker)).toEqual(kanbanTail);
	});

	it("complete file: exists with the contract and no brainRepair", async () => {
		await writeBrainAide(obsidianBrainAideTemplate());

		const step = await buildBrainAideStep(projectRoot);

		expect(step.status).toBe("exists");
		expect(step.content).toBeUndefined();
		expect(step.brainContract).toEqual(brainContract);
		expect(step.brainRepair).toBeUndefined();
	});

	it("malformed file: exists with the contract and no brainRepair", async () => {
		await writeBrainAide("arbitrary content");

		const step = await buildBrainAideStep(projectRoot);

		expect(step.status).toBe("exists");
		expect(step.brainContract).toEqual(brainContract);
		expect(step.brainRepair).toBeUndefined();
	});

	it("absent file with brainMode global: content parses to the global launcher", async () => {
		const step = await buildBrainAideStep(projectRoot, "global");

		expect(step.status).toBe("would-create");
		expect(step.content).toBe(obsidianBrainAideTemplate("global"));
		const parsed = parseBrainAideFromString(step.content!);
		expect(parsed.kind).toBe("ok");
		if (parsed.kind !== "ok") return;
		expect(parsed.mcpServerConfig.command).toBe("mcpvault");
		expect(parsed.mcpServerConfig.args.at(-1)).toBeNull();
	});

	it("absent file with brainMode omitted: content equals the default template", async () => {
		const step = await buildBrainAideStep(projectRoot);

		expect(step.content).toBe(obsidianBrainAideTemplate());
	});

	it("existing file with brainMode global: still exists with no content (mode never overrides presence)", async () => {
		await writeBrainAide(obsidianBrainAideTemplate());

		const step = await buildBrainAideStep(projectRoot, "global");

		expect(step.status).toBe("exists");
		expect(step.content).toBeUndefined();
	});

	it("existing v0.9.0 file: carries brainRepair and brainMigration, and the file is untouched", async () => {
		const fixture = await readFile(
			join(dirname(fileURLToPath(import.meta.url)), "..", "detectBrainMigration", "__fixtures__", "v0.9.0-brain.txt"),
			"utf-8",
		);
		await writeBrainAide(fixture);
		const filePath = join(projectRoot, ".aide", "config", "brain.aide");

		const step = await buildBrainAideStep(projectRoot);

		expect(step.status).toBe("exists");
		expect(step.brainRepair?.map((r) => r.marker)).toEqual(kanbanTail);
		expect(step.brainMigration?.staleSections.map((s) => s.marker)).toEqual(["orientation", "config"]);
		expect(step.brainMigration?.legacyLauncher).not.toBeNull();
		expect(await readFile(filePath, "utf-8")).toBe(fixture);
	});

	it("existing current template (local): no brainMigration key", async () => {
		await writeBrainAide(obsidianBrainAideTemplate("local"));

		const step = await buildBrainAideStep(projectRoot);

		expect(step.status).toBe("exists");
		expect("brainMigration" in step).toBe(false);
	});

	it("absent file (would-create): no brainMigration key", async () => {
		const step = await buildBrainAideStep(projectRoot);

		expect(step.status).toBe("would-create");
		expect("brainMigration" in step).toBe(false);
	});
});
