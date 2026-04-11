import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import writeMethodology from "./index.js";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");
const DOCS_ROOT = join(REPO_ROOT, "docs");

const CANONICAL_METHODOLOGY_FILES = [
	"aide-spec.md",
	"aide-template.md",
	"progressive-disclosure.md",
	"agent-readable-code.md",
	"automated-qa.md",
];

let tempDir: string;

beforeEach(async () => {
	tempDir = await mkdtemp(join(tmpdir(), "aide-methodology-"));
});

afterEach(async () => {
	await rm(tempDir, { recursive: true, force: true });
});

describe("writeMethodology", () => {
	it("creates config file with methodology when none exists", async () => {
		const configPath = join(tempDir, "CLAUDE.md");

		const result = await writeMethodology(configPath);

		expect(result).toEqual({ name: "Methodology", status: "created" });
		const config = await readFile(configPath, "utf-8");
		expect(config).toContain("<!-- aide-methodology -->");
	});

	it("appends methodology to existing config without overwriting", async () => {
		const configPath = join(tempDir, "CLAUDE.md");
		const existing = "# My Project\n\nExisting content here.\n";
		await writeFile(configPath, existing, "utf-8");

		await writeMethodology(configPath);

		const config = await readFile(configPath, "utf-8");
		expect(config).toContain("Existing content here.");
		expect(config).toContain("<!-- aide-methodology -->");
	});

	it("is idempotent — returns exists when marker already present", async () => {
		const configPath = join(tempDir, "CLAUDE.md");
		await writeMethodology(configPath);

		const result = await writeMethodology(configPath);

		expect(result).toEqual({ name: "Methodology", status: "exists" });
	});

	it("composes the block verbatim from all five canonical methodology docs", async () => {
		const configPath = join(tempDir, "CLAUDE.md");
		await writeMethodology(configPath);
		const config = await readFile(configPath, "utf-8");

		for (const file of CANONICAL_METHODOLOGY_FILES) {
			const bytes = readFileSync(join(DOCS_ROOT, file), "utf-8");
			expect(config).toContain(bytes);
		}
	});

	it("wraps the body in opening and closing markers with the body between them", async () => {
		const configPath = join(tempDir, "CLAUDE.md");
		await writeMethodology(configPath);
		const config = await readFile(configPath, "utf-8");

		const marker = "<!-- aide-methodology -->";
		const first = config.indexOf(marker);
		const last = config.lastIndexOf(marker);
		expect(first).toBeGreaterThanOrEqual(0);
		expect(last).toBeGreaterThan(first);

		// At least one canonical doc's content sits between the two markers.
		const between = config.slice(first + marker.length, last);
		const aideSpec = readFileSync(join(DOCS_ROOT, "aide-spec.md"), "utf-8");
		expect(between).toContain(aideSpec);
	});

	it("never reintroduces the stale 'Intel-Driven' wording from the old literal", async () => {
		// Narrow textual regression guard: the pre-refactor literal path once
		// mis-spelled "Intent-Driven" as "Intel-Driven". If a future change
		// reintroduces an embedded literal, this is the cheapest detector.
		const configPath = join(tempDir, "CLAUDE.md");
		await writeMethodology(configPath);
		const config = await readFile(configPath, "utf-8");
		expect(config).not.toContain("Intel-Driven");
	});
});
