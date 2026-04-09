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
});
