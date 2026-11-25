import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import compareFiles from "./index.js";

let folder: string;

beforeEach(async () => {
	folder = await mkdtemp(path.join(tmpdir(), "aide-compare-"));
});

afterEach(async () => {
	await rm(folder, { recursive: true, force: true });
});

async function seed({ source, target }: { source: string; target?: string }) {
	const sourcePath = path.join(folder, "source.jsonl");
	const targetPath = path.join(folder, "target.jsonl");
	await writeFile(sourcePath, source);
	if (target !== undefined) await writeFile(targetPath, target);
	return { source: sourcePath, target: targetPath };
}

describe("compareFiles", () => {
	it.each([
		["missing", "a\nb\n", undefined],
		["same", "a\nb\n", "a\nb\n"],
		["target-behind", "a\nb\n", "a\n"],
		["target-behind", "a\nb\n", ""],
		["target-ahead", "a\n", "a\nb\n"],
		["diverged", "a\nb\n", "a\nc\n"],
		["diverged", "a\nb\n", "x"],
	] as const)("answers %s", async (expected, source, target) => {
		expect(await compareFiles(await seed({ source, target }))).toBe(expected);
	});

	it("throws on a missing source", async () => {
		await expect(
			compareFiles({ source: path.join(folder, "nope.jsonl"), target: path.join(folder, "target.jsonl") }),
		).rejects.toThrow();
	});

	it("throws on a target read error other than a missing file", async () => {
		const paths = await seed({ source: "a" });
		await expect(compareFiles({ source: paths.source, target: folder })).rejects.toThrow();
	});
});
