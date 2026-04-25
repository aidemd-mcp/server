import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import compareBytes from "./index.js";

let tempDir: string;

beforeEach(async () => {
	tempDir = await mkdtemp(join(tmpdir(), "aide-compare-bytes-"));
});

afterEach(async () => {
	await rm(tempDir, { recursive: true, force: true });
});

describe("compareBytes", () => {
	it("missing file returns would-create", async () => {
		const filePath = join(tempDir, "missing.md");

		const result = await compareBytes(filePath, "canonical content\n");

		expect(result).toBe("would-create");
	});

	it("file with matching bytes returns would-skip", async () => {
		const filePath = join(tempDir, "file.md");
		const content = "# Hello\n\nSame bytes.\n";
		await writeFile(filePath, content, "utf-8");

		const result = await compareBytes(filePath, content);

		expect(result).toBe("would-skip");
	});

	it("file with differing bytes returns would-overwrite", async () => {
		const filePath = join(tempDir, "file.md");
		await writeFile(filePath, "# Old content\n", "utf-8");

		const result = await compareBytes(filePath, "# New content\n");

		expect(result).toBe("would-overwrite");
	});

	it("non-ENOENT error (directory at the path) rethrows", async () => {
		const dirPath = join(tempDir, "is-a-directory");
		await mkdir(dirPath);

		await expect(compareBytes(dirPath, "any content\n")).rejects.toThrow();
	});
});
