import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import deriveProjectName from "./index.js";

let tempDir: string;

beforeEach(async () => {
	tempDir = await mkdtemp(join(tmpdir(), "aide-derive-project-name-"));
});

afterEach(async () => {
	await rm(tempDir, { recursive: true, force: true });
});

describe("deriveProjectName", () => {
	it("returns package.json name when name field is present", async () => {
		await writeFile(join(tempDir, "package.json"), JSON.stringify({ name: "my-awesome-lib" }), "utf-8");

		const result = await deriveProjectName(tempDir);

		expect(result).toBe("my-awesome-lib");
	});

	it("falls back to folder name when package.json has no name field", async () => {
		await writeFile(join(tempDir, "package.json"), JSON.stringify({ version: "1.0.0" }), "utf-8");

		// tempDir ends with a suffix like "aide-derive-project-name-XXXXXX"
		// We want a predictable folder name, so create a subdirectory
		const subDir = join(tempDir, "my-project");
		await import("node:fs/promises").then((fs) => fs.mkdir(subDir));

		const result = await deriveProjectName(subDir);

		expect(result).toBe("My Project");
	});

	it("falls back to folder name when no package.json exists", async () => {
		const subDir = join(tempDir, "cool-tool");
		await import("node:fs/promises").then((fs) => fs.mkdir(subDir));

		const result = await deriveProjectName(subDir);

		expect(result).toBe("Cool Tool");
	});

	it("title-cases and splits hyphenated folder names", async () => {
		const subDir = join(tempDir, "my-cool-project");
		await import("node:fs/promises").then((fs) => fs.mkdir(subDir));

		const result = await deriveProjectName(subDir);

		expect(result).toBe("My Cool Project");
	});

	it("returns package.json name verbatim even if it contains hyphens", async () => {
		await writeFile(
			join(tempDir, "package.json"),
			JSON.stringify({ name: "@scope/my-package" }),
			"utf-8",
		);

		const result = await deriveProjectName(tempDir);

		expect(result).toBe("@scope/my-package");
	});

	it("falls back to folder name when package.json name is an empty string", async () => {
		const subDir = join(tempDir, "empty-name-project");
		await import("node:fs/promises").then((fs) => fs.mkdir(subDir));
		await writeFile(join(subDir, "package.json"), JSON.stringify({ name: "" }), "utf-8");

		const result = await deriveProjectName(subDir);

		expect(result).toBe("Empty Name Project");
	});

	it("falls back to folder name when package.json is malformed JSON", async () => {
		const subDir = join(tempDir, "broken-json-project");
		await import("node:fs/promises").then((fs) => fs.mkdir(subDir));
		await writeFile(join(subDir, "package.json"), "not valid json {{{", "utf-8");

		const result = await deriveProjectName(subDir);

		expect(result).toBe("Broken Json Project");
	});
});
