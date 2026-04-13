import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import discover from "./index.js";

let tempDir: string;

beforeEach(async () => {
	tempDir = await mkdtemp(join(tmpdir(), "aide-discover-"));
});

afterEach(async () => {
	await rm(tempDir, { recursive: true, force: true });
});

describe("discover", () => {
	it("returns 'no files found' when project has no .aide files", async () => {
		await writeFile(join(tempDir, "index.ts"), "// nothing");

		const result = await discover(tempDir);

		expect(result).toContain("No .aide files found");
	});

	it("returns tree with header showing spec count", async () => {
		await writeFile(join(tempDir, "index.ts"), "export default function() {}");
		await writeFile(join(tempDir, ".aide"), "Root spec for the module");
		await mkdir(join(tempDir, "sub"), { recursive: true });
		await writeFile(join(tempDir, "sub", "research.aide"), "Research data");

		const result = await discover(tempDir);

		expect(result).toContain("2 specs found");
		expect(result).toContain("[intent]");
		expect(result).toContain("[research]");
	});

	it("shallow scan (no path) omits summaries and warnings", async () => {
		await writeFile(join(tempDir, ".aide"), "# Title\n\nSummary content here");
		await writeFile(join(tempDir, "intent.aide"), "Also intent");
		await writeFile(join(tempDir, "index.ts"), "export default function() {}");

		const result = await discover(tempDir);

		expect(result).toContain("[intent]");
		expect(result).not.toContain("Summary content here");
		expect(result).not.toContain("⚠ Warnings:");
	});

	it("deep scan (with path) includes summaries and warnings", async () => {
		await writeFile(join(tempDir, ".aide"), "# Title\n\nIntent summary");
		await writeFile(join(tempDir, "intent.aide"), "Also intent");
		await writeFile(join(tempDir, "index.ts"), "export default function() {}");

		const result = await discover(tempDir, ".");

		expect(result).toContain("Intent summary");
		expect(result).toContain("⚠ Warnings:");
		expect(result).toContain("Both .aide and intent.aide");
	});

	it("scopes scan to subdirectory when path is provided", async () => {
		await mkdir(join(tempDir, "a"), { recursive: true });
		await mkdir(join(tempDir, "b"), { recursive: true });
		await writeFile(join(tempDir, "a", ".aide"), "A spec");
		await writeFile(join(tempDir, "b", ".aide"), "B spec");

		const result = await discover(tempDir, "a");

		expect(result).toContain("1 spec found");
	});

	it("deep scan includes ancestor chain before subtree when ancestors exist", async () => {
		// Root-level ancestor spec
		await mkdir(join(tempDir, ".aide"), { recursive: true });
		await writeFile(
			join(tempDir, ".aide", "intent.aide"),
			"---\ndescription: Root project intent\n---\n",
		);

		// Target subtree with its own spec
		await mkdir(join(tempDir, "src"), { recursive: true });
		await writeFile(join(tempDir, "src", ".aide"), "---\ndescription: Src spec\n---\n");

		const result = await discover(tempDir, "src");

		expect(result).toContain("Ancestor chain:");
		expect(result).toContain("Root project intent");

		// Ancestor chain must appear before the tree
		const ancestorIndex = result.indexOf("Ancestor chain:");
		const treeIndex = result.indexOf("src/");
		expect(ancestorIndex).toBeGreaterThanOrEqual(0);
		expect(treeIndex).toBeGreaterThanOrEqual(0);
		expect(ancestorIndex).toBeLessThan(treeIndex);
	});

	it("deep scan with no ancestors above target omits ancestor chain section", async () => {
		// No specs above the target — only a spec inside the target
		await mkdir(join(tempDir, "sub"), { recursive: true });
		await writeFile(join(tempDir, "sub", ".aide"), "---\ndescription: Sub spec\n---\n");

		const result = await discover(tempDir, "sub");

		expect(result).not.toContain("Ancestor chain:");
	});

	it("shallow scan (no path) does not include ancestor chain", async () => {
		await mkdir(join(tempDir, ".aide"), { recursive: true });
		await writeFile(
			join(tempDir, ".aide", "intent.aide"),
			"---\ndescription: Root intent\n---\n",
		);

		const result = await discover(tempDir);

		expect(result).not.toContain("Ancestor chain:");
	});
});
