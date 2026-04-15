import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, writeFile, readdir, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import scaffold from "./index.js";

let tempDir: string;

beforeEach(async () => {
	tempDir = await mkdtemp(join(tmpdir(), "aide-scaffold-"));
});

afterEach(async () => {
	await rm(tempDir, { recursive: true, force: true });
});

describe("scaffold", () => {
	it("creates .aide for intent type when no research exists", async () => {
		const result = await scaffold(tempDir, ".", "intent");

		expect(result).toContain("Created .aide");
		const files = await readdir(tempDir);
		expect(files).toContain(".aide");
	});

	it("creates intent.aide when research.aide already exists", async () => {
		await writeFile(join(tempDir, "research.aide"), "Research");

		const result = await scaffold(tempDir, ".", "intent");

		expect(result).toContain("Created intent.aide");
		const files = await readdir(tempDir);
		expect(files).toContain("intent.aide");
		expect(files).toContain("research.aide");
	});

	it("creates research.aide and renames .aide to intent.aide", async () => {
		await writeFile(join(tempDir, ".aide"), "Original intent");

		const result = await scaffold(tempDir, ".", "research");

		expect(result).toContain("Renamed .aide → intent.aide");
		expect(result).toContain("Created research.aide");

		const files = await readdir(tempDir);
		expect(files).toContain("intent.aide");
		expect(files).toContain("research.aide");
		expect(files).not.toContain(".aide");

		// Verify original content was preserved in rename
		const content = await readFile(join(tempDir, "intent.aide"), "utf-8");
		expect(content).toBe("Original intent");
	});

	it("creates both files for type=both", async () => {
		const result = await scaffold(tempDir, ".", "both");

		expect(result).toContain("Created intent.aide");
		expect(result).toContain("Created research.aide");

		const files = await readdir(tempDir);
		expect(files).toContain("intent.aide");
		expect(files).toContain("research.aide");
	});

	it("creates todo.aide for type=todo", async () => {
		const result = await scaffold(tempDir, ".", "todo");

		expect(result).toContain("Created todo.aide");
		const files = await readdir(tempDir);
		expect(files).toContain("todo.aide");

		const content = await readFile(join(tempDir, "todo.aide"), "utf-8");
		expect(content).toContain("QA Re-alignment Document");
		expect(content).toContain("description:");
	});

	it("intent template includes frontmatter with description and scope", async () => {
		await scaffold(tempDir, ".", "intent");

		const content = await readFile(join(tempDir, ".aide"), "utf-8");
		expect(content).toContain("---");
		expect(content).toContain("scope:");
		expect(content).toContain("description:");
		expect(content).toContain("intent:");
		expect(content).toContain("outcomes:");
	});

	it("plan template includes frontmatter with description", async () => {
		await scaffold(tempDir, ".", "plan");

		const content = await readFile(join(tempDir, "plan.aide"), "utf-8");
		expect(content).toContain("---");
		expect(content).toContain("description:");
	});

	it("creates directory if it does not exist", async () => {
		const subDir = join(tempDir, "new", "nested");

		await scaffold(tempDir, "new/nested", "intent");

		const files = await readdir(subDir);
		expect(files).toContain(".aide");
	});
});
