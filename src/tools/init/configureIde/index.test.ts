import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, mkdir, writeFile, rm, access } from "node:fs/promises";
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
	it("returns would-create when no settings.json exists", async () => {
		const result = await configureZed(tempDir);

		expect(result.status).toBe("would-create");
		expect(result.category).toBe("ide");
		expect(result.name).toBe("Zed config");
	});

	it("would-create content has *.aide in Markdown file_types", async () => {
		const result = await configureZed(tempDir);

		expect(result.content).toBeTruthy();
		const settings = JSON.parse(result.content!);
		expect(settings.file_types.Markdown).toContain("*.aide");
	});

	it("would-create content preserves existing settings", async () => {
		const existing = {
			theme: "One Dark",
			font_size: 14,
			file_types: { YAML: ["*.yml"] },
		};
		await mkdir(join(tempDir, ".zed"), { recursive: true });
		await writeFile(join(tempDir, ".zed", "settings.json"), JSON.stringify(existing), "utf-8");

		const result = await configureZed(tempDir);

		expect(result.status).toBe("would-create");
		const settings = JSON.parse(result.content!);
		expect(settings.theme).toBe("One Dark");
		expect(settings.font_size).toBe(14);
		expect(settings.file_types.YAML).toEqual(["*.yml"]);
		expect(settings.file_types.Markdown).toContain("*.aide");
	});

	it("would-create content preserves existing Markdown file_types", async () => {
		const existing = {
			file_types: { Markdown: ["*.mdx", "*.mdoc"] },
		};
		await mkdir(join(tempDir, ".zed"), { recursive: true });
		await writeFile(join(tempDir, ".zed", "settings.json"), JSON.stringify(existing), "utf-8");

		const result = await configureZed(tempDir);

		const settings = JSON.parse(result.content!);
		expect(settings.file_types.Markdown).toEqual(["*.mdx", "*.mdoc", "*.aide"]);
	});

	it("returns exists when *.aide is already in Markdown file_types", async () => {
		const existing = {
			file_types: { Markdown: ["*.aide"] },
		};
		await mkdir(join(tempDir, ".zed"), { recursive: true });
		await writeFile(join(tempDir, ".zed", "settings.json"), JSON.stringify(existing), "utf-8");

		const result = await configureZed(tempDir);

		expect(result.status).toBe("exists");
		expect(result.content).toBeUndefined();
	});

	it("returns would-skip when settings.json contains invalid JSON", async () => {
		await mkdir(join(tempDir, ".zed"), { recursive: true });
		await writeFile(join(tempDir, ".zed", "settings.json"), "not valid {{{", "utf-8");

		const result = await configureZed(tempDir);

		expect(result.status).toBe("would-skip");
	});

	it("never writes to disk", async () => {
		await configureZed(tempDir);

		await expect(access(join(tempDir, ".zed", "settings.json"))).rejects.toThrow();
	});

	it("filePath points to .zed/settings.json", async () => {
		const result = await configureZed(tempDir);

		expect(result.filePath).toContain(".zed");
		expect(result.filePath).toContain("settings.json");
	});
});
