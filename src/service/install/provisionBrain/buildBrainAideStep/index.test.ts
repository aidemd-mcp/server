import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, mkdir, writeFile, readFile, rm } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import buildBrainAideStep from "./index.js";
import obsidianBrainAideTemplate from "../obsidianBrainAideTemplate/index.js";
import parseBundledTemplate from "../parseBundledTemplate/index.js";
import listBrainSections from "./summarizeBrainConfig/listBrainSections/index.js";
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

const emptyFindings = { missingSections: [], staleSections: [], legacyLauncher: null, templateIntegration: null };

/** The bundled template cut just before the kanban-index section. */
function outdatedTemplate(): string {
	const full = obsidianBrainAideTemplate();
	return full.slice(0, full.indexOf(toMarkerPair("kanban-index").open));
}

/** Collect every string value reachable from a value (keys excluded). */
function collectStrings(value: unknown, out: string[] = []): string[] {
	if (typeof value === "string") out.push(value);
	else if (Array.isArray(value)) value.forEach((v) => collectStrings(v, out));
	else if (value && typeof value === "object") Object.values(value).forEach((v) => collectStrings(v, out));
	return out;
}

describe("buildBrainAideStep", () => {
	it("absent file: would-create with template content and an empty-findings brainSummary", async () => {
		const step = await buildBrainAideStep(projectRoot);

		expect(step.name).toBe("Brain config (brain.aide)");
		expect(step.status).toBe("would-create");
		expect(step.content).toBe(obsidianBrainAideTemplate());
		expect(step.brainSummary).toEqual({ sections: listBrainSections(), ...emptyFindings });
	});

	it("outdated file: exists with brainSummary.missingSections and no content", async () => {
		await writeBrainAide(outdatedTemplate());

		const step = await buildBrainAideStep(projectRoot);

		expect(step.status).toBe("exists");
		expect(step.content).toBeUndefined();
		expect(step.brainSummary?.sections).toEqual(listBrainSections());
		expect(step.brainSummary?.missingSections).toEqual(kanbanTail);
	});

	it("complete file: exists with empty findings", async () => {
		await writeBrainAide(obsidianBrainAideTemplate());

		const step = await buildBrainAideStep(projectRoot);

		expect(step.status).toBe("exists");
		expect(step.content).toBeUndefined();
		expect(step.brainSummary?.missingSections).toEqual([]);
		expect(step.brainSummary?.staleSections).toEqual([]);
		expect(step.brainSummary?.legacyLauncher).toBeNull();
	});

	it("malformed file: exists with empty findings and templateIntegration null", async () => {
		await writeBrainAide("arbitrary content");

		const step = await buildBrainAideStep(projectRoot);

		expect(step.status).toBe("exists");
		expect(step.brainSummary).toEqual({ sections: listBrainSections(), ...emptyFindings });
		expect(step.brainSummary?.templateIntegration).toBeNull();
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

	it("existing v0.9.0 file: brainSummary carries missing, stale and legacy reasons, and the file is untouched", async () => {
		const fixture = await readFile(
			join(dirname(fileURLToPath(import.meta.url)), "..", "detectBrainMigration", "__fixtures__", "v0.9.0-brain.txt"),
			"utf-8",
		);
		await writeBrainAide(fixture);
		const filePath = join(projectRoot, ".aide", "config", "brain.aide");

		const step = await buildBrainAideStep(projectRoot);

		expect(step.status).toBe("exists");
		expect(step.brainSummary?.missingSections).toEqual(kanbanTail);
		expect(step.brainSummary?.staleSections).toEqual(["orientation", "config"]);
		expect(step.brainSummary?.legacyLauncher).toEqual(["unpinned", "missing-auto-confirm"]);
		expect(await readFile(filePath, "utf-8")).toBe(fixture);
	});

	it("existing current template (local): no stale sections and no legacy launcher", async () => {
		await writeBrainAide(obsidianBrainAideTemplate("local"));

		const step = await buildBrainAideStep(projectRoot);

		expect(step.status).toBe("exists");
		expect(step.brainSummary?.staleSections).toEqual([]);
		expect(step.brainSummary?.legacyLauncher).toBeNull();
	});

	it("never carries brainContract, brainRepair or brainMigration on any status", async () => {
		const absent = await buildBrainAideStep(projectRoot);
		await writeBrainAide(obsidianBrainAideTemplate());
		const complete = await buildBrainAideStep(projectRoot);
		await writeBrainAide(outdatedTemplate());
		const outdated = await buildBrainAideStep(projectRoot);
		await writeBrainAide("arbitrary content");
		const malformed = await buildBrainAideStep(projectRoot);

		for (const step of [absent, complete, outdated, malformed]) {
			expect("brainContract" in step).toBe(false);
			expect("brainRepair" in step).toBe(false);
			expect("brainMigration" in step).toBe(false);
		}
	});

	it("no string value anywhere in an exists step contains a template section's text", async () => {
		const template = parseBundledTemplate();
		await writeBrainAide(outdatedTemplate());

		const step = await buildBrainAideStep(projectRoot);

		const strings = collectStrings(step);
		for (const entry of brainContract) {
			const text = template[entry.field].trim();
			expect(text.length).toBeGreaterThan(0);
			for (const value of strings) expect(value.includes(text)).toBe(false);
		}
	});
});
