import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import holdsCode from "./index.js";

let root: string;

async function put(...rels: string[]): Promise<void> {
	for (const rel of rels) {
		const full = join(root, rel);
		await mkdir(dirname(full), { recursive: true });
		await writeFile(full, "x");
	}
}

beforeEach(async () => {
	root = await mkdtemp(join(tmpdir(), "holds-code-"));
});

afterEach(async () => {
	await rm(root, { recursive: true, force: true });
});

describe("holdsCode", () => {
	it("is true for index.ts at the top", async () => {
		await put("index.ts");
		expect(await holdsCode(root)).toBe(true);
	});

	it("is true for run.py at the top", async () => {
		await put("run.py");
		expect(await holdsCode(root)).toBe(true);
	});

	it("is true when code lives only in a helper subfolder", async () => {
		await put(".aide", "helperA/index.ts");
		expect(await holdsCode(root)).toBe(true);
	});

	it("is true for code two levels down", async () => {
		await put("a/b/run.go");
		expect(await holdsCode(root)).toBe(true);
	});

	it("is false with only AIDE files and Markdown", async () => {
		await put(".aide", "plan.aide", "brief.aide", "README.md");
		expect(await holdsCode(root)).toBe(false);
	});

	it("is false with only Markdown and AIDE files over subfolders", async () => {
		await put("docs/guide.md", "docs/.aide");
		expect(await holdsCode(root)).toBe(false);
	});

	it("is false for an empty folder", async () => {
		expect(await holdsCode(root)).toBe(false);
	});

	it("is false when code sits only in skipped folders", async () => {
		await put("node_modules/x.js", "dist/x.js", ".git/x", ".cache/x.js");
		expect(await holdsCode(root)).toBe(false);
	});

	it("is false for a folder that does not exist", async () => {
		expect(await holdsCode(join(root, "missing"))).toBe(false);
	});

	it("is false with only .aide and .DS_Store", async () => {
		await put(".aide", ".DS_Store");
		expect(await holdsCode(root)).toBe(false);
	});

	it("is false with only dot-files over subfolders", async () => {
		await put(".gitkeep", "sub/.gitignore");
		expect(await holdsCode(root)).toBe(false);
	});
});
