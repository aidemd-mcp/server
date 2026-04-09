import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import read from "./index.js";

let tempDir: string;

beforeEach(async () => {
	tempDir = await mkdtemp(join(tmpdir(), "aide-read-"));
});

afterEach(async () => {
	await rm(tempDir, { recursive: true, force: true });
});

describe("read", () => {
	it("reads file content and classifies type", async () => {
		await writeFile(join(tempDir, "research.aide"), "# Research\n\nSome findings.");

		const result = await read(tempDir, "research.aide");

		expect(result.content).toContain("# Research");
		expect(result.type).toBe("research");
	});

	it("finds sibling .aide files", async () => {
		await writeFile(join(tempDir, "intent.aide"), "Intent spec");
		await writeFile(join(tempDir, "research.aide"), "Research spec");

		const result = await read(tempDir, "intent.aide");

		expect(result.siblings).toHaveLength(1);
		expect(result.siblings[0].type).toBe("research");
	});

	it("extracts wikilinks", async () => {
		await writeFile(
			join(tempDir, ".aide"),
			"See [[coding-playbook/workflow/spec-documents]] for details.",
		);

		const result = await read(tempDir, ".aide");

		expect(result.links).toContain("[[coding-playbook/workflow/spec-documents]]");
	});

	it("extracts relative paths", async () => {
		await writeFile(join(tempDir, ".aide"), "Check ./helpers/index.ts and ../shared/utils.ts");

		const result = await read(tempDir, ".aide");

		expect(result.links).toContain("./helpers/index.ts");
		expect(result.links).toContain("../shared/utils.ts");
	});

	it("extracts URLs", async () => {
		await writeFile(join(tempDir, ".aide"), "Reference: https://example.com/docs");

		const result = await read(tempDir, ".aide");

		expect(result.links).toContain("https://example.com/docs");
	});

	it("returns error content for missing file", async () => {
		const result = await read(tempDir, "nonexistent.aide");

		expect(result.content).toContain("Path not found");
		expect(result.links).toHaveLength(0);
	});

	it("deduplicates links", async () => {
		await writeFile(
			join(tempDir, ".aide"),
			"See [[link]] and [[link]] again.",
		);

		const result = await read(tempDir, ".aide");

		expect(result.links.filter((l) => l === "[[link]]")).toHaveLength(1);
	});
});
