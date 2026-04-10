import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, mkdir, writeFile, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { configureZed } from "./index.js";

let tempDir: string;

beforeEach(async () => {
	tempDir = await mkdtemp(join(tmpdir(), "aide-ide-"));
});

afterEach(async () => {
	await rm(tempDir, { recursive: true, force: true });
});

describe("configureZed", () => {
	it("creates .zed/settings.json when none exists", async () => {
		const result = await configureZed(tempDir);

		expect(result).toEqual({ name: "Zed config", status: "created" });

		const settings = JSON.parse(await readFile(join(tempDir, ".zed", "settings.json"), "utf-8"));
		expect(settings.file_types.Markdown).toContain("*.aide");
	});

	it("merges into existing settings without overwriting", async () => {
		const existing = {
			theme: "One Dark",
			font_size: 14,
			file_types: { YAML: ["*.yml"] },
		};
		await mkdir(join(tempDir, ".zed"), { recursive: true });
		await writeFile(join(tempDir, ".zed", "settings.json"), JSON.stringify(existing), "utf-8");

		const result = await configureZed(tempDir);

		expect(result.status).toBe("created");

		const settings = JSON.parse(await readFile(join(tempDir, ".zed", "settings.json"), "utf-8"));
		expect(settings.theme).toBe("One Dark");
		expect(settings.font_size).toBe(14);
		expect(settings.file_types.YAML).toEqual(["*.yml"]);
		expect(settings.file_types.Markdown).toContain("*.aide");
	});

	it("preserves existing Markdown file_types entries", async () => {
		const existing = {
			file_types: { Markdown: ["*.mdx", "*.mdoc"] },
		};
		await mkdir(join(tempDir, ".zed"), { recursive: true });
		await writeFile(join(tempDir, ".zed", "settings.json"), JSON.stringify(existing), "utf-8");

		await configureZed(tempDir);

		const settings = JSON.parse(await readFile(join(tempDir, ".zed", "settings.json"), "utf-8"));
		expect(settings.file_types.Markdown).toEqual(["*.mdx", "*.mdoc", "*.aide"]);
	});

	it("returns exists when *.aide is already in Markdown file_types", async () => {
		const existing = {
			file_types: { Markdown: ["*.aide"] },
		};
		await mkdir(join(tempDir, ".zed"), { recursive: true });
		await writeFile(join(tempDir, ".zed", "settings.json"), JSON.stringify(existing), "utf-8");

		const result = await configureZed(tempDir);

		expect(result).toEqual({ name: "Zed config", status: "exists" });
	});

	it("is idempotent — second run returns exists", async () => {
		await configureZed(tempDir);
		const result = await configureZed(tempDir);

		expect(result.status).toBe("exists");
	});

	it("skips when settings.json contains invalid JSON", async () => {
		await mkdir(join(tempDir, ".zed"), { recursive: true });
		await writeFile(join(tempDir, ".zed", "settings.json"), "not valid {{{", "utf-8");

		const result = await configureZed(tempDir);

		expect(result.status).toBe("skipped");
	});
});
