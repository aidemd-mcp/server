import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import buildBrainAideStep from "./index.js";
import obsidianBrainAideTemplate from "../obsidianBrainAideTemplate/index.js";
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
	.slice(brainContract.findIndex((entry) => entry.marker === "kanban-board"))
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
		const cutAt = full.indexOf(toMarkerPair("kanban-board").open);
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
});
