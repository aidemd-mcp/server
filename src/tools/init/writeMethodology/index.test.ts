import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import writeMethodology from "./index.js";

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
		expect(config).toContain("AIDE");
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
});
