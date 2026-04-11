import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import writeMethodology from "./index.js";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");
const METHODOLOGY_ROOT = join(REPO_ROOT, ".aide", "docs");

const HUB_DIR = ".aide";

let tempDir: string;

beforeEach(async () => {
	tempDir = await mkdtemp(join(tmpdir(), "aide-methodology-"));
});

afterEach(async () => {
	await rm(tempDir, { recursive: true, force: true });
});

describe("writeMethodology", () => {
	it("creates config file with a marker-bounded pointer stub when none exists", async () => {
		const configPath = join(tempDir, "CLAUDE.md");

		const result = await writeMethodology(configPath, HUB_DIR);

		expect(result).toEqual({ name: "Methodology pointer", status: "created" });
		const config = await readFile(configPath, "utf-8");
		expect(config).toContain("<!-- aide-methodology -->");
	});

	it("stub body names the hub path and leaves no unsubstituted placeholders", async () => {
		const configPath = join(tempDir, "CLAUDE.md");

		await writeMethodology(configPath, HUB_DIR);

		const config = await readFile(configPath, "utf-8");
		expect(config).toContain(`${HUB_DIR}/index.md`);
		expect(config).not.toContain("{{HUB_PATH}}");
	});

	it("stub names the host-side doc hub path passed in", async () => {
		const configPath = join(tempDir, "CLAUDE.md");

		await writeMethodology(configPath, HUB_DIR);

		const config = await readFile(configPath, "utf-8");
		expect(config).toContain(HUB_DIR);
	});

	it("stub does not ship the full canonical methodology body", async () => {
		// Pins writeMethodology/.aide outcomes.undesired: "the stub ships the
		// full concatenated methodology body". If a future change
		// reintroduces the block, a distinctive line from aide-spec.md will
		// reappear in the config file and this test will catch it.
		const configPath = join(tempDir, "CLAUDE.md");

		await writeMethodology(configPath, HUB_DIR);

		const config = await readFile(configPath, "utf-8");
		const canonicalSpec = readFileSync(join(METHODOLOGY_ROOT, "aide-spec.md"), "utf-8");
		// Pick a long, distinctive line from aide-spec.md (not present in the
		// stub) and assert it is absent from the written config.
		const distinctive = canonicalSpec
			.split("\n")
			.find(
				(line) =>
					line.length > 60 &&
					line.includes("progressive") === false &&
					line.includes("AIDE") === false,
			);
		expect(distinctive).toBeTruthy();
		if (distinctive) expect(config).not.toContain(distinctive);
	});

	it("appends stub to existing config without overwriting pre-existing content", async () => {
		const configPath = join(tempDir, "CLAUDE.md");
		const existing = "# My Project\n\nExisting content here.\n";
		await writeFile(configPath, existing, "utf-8");

		await writeMethodology(configPath, HUB_DIR);

		const config = await readFile(configPath, "utf-8");
		expect(config).toContain("Existing content here.");
		expect(config).toContain("<!-- aide-methodology -->");
	});

	it("is idempotent — returns exists when marker already present", async () => {
		const configPath = join(tempDir, "CLAUDE.md");
		await writeMethodology(configPath, HUB_DIR);

		const result = await writeMethodology(configPath, HUB_DIR);

		expect(result).toEqual({ name: "Methodology pointer", status: "exists" });
	});

	it("never reintroduces the stale 'Intel-Driven' wording from the old literal", async () => {
		// Narrow textual regression guard: the pre-refactor literal path once
		// mis-spelled "Intent-Driven" as "Intel-Driven". If a future change
		// reintroduces an embedded literal, this is the cheapest detector.
		const configPath = join(tempDir, "CLAUDE.md");
		await writeMethodology(configPath, HUB_DIR);
		const config = await readFile(configPath, "utf-8");
		expect(config).not.toContain("Intel-Driven");
	});
});
