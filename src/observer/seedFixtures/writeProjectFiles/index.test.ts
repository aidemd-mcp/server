import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import writeProjectFiles from "./index.js";

let base: string;
let projectRoot: string;

beforeEach(async () => {
	base = await mkdtemp(join(tmpdir(), "aide-write-files-"));
	projectRoot = join(base, "project");
});

afterEach(async () => {
	await rm(base, { recursive: true, force: true });
});

describe("writeProjectFiles", () => {
	it("creates the root and each file's folders and writes the content", async () => {
		await writeProjectFiles({ projectRoot, files: { ".aide/intent.aide": "root\n", "src/tools/score/.aide": "score\n" } });

		expect(await readFile(join(projectRoot, ".aide", "intent.aide"), "utf-8")).toBe("root\n");
		expect(await readFile(join(projectRoot, "src", "tools", "score", ".aide"), "utf-8")).toBe("score\n");
	});

	it("refuses a path that climbs out of the root and writes nothing", async () => {
		await expect(writeProjectFiles({ projectRoot, files: { "ok.txt": "fine", "../x": "escape" } })).rejects.toThrow(
			'Fixture file "../x" resolves outside the project root.',
		);

		expect(await readdir(base)).toEqual([]);
	});

	it("refuses a path that climbs out through a nested segment", async () => {
		await expect(writeProjectFiles({ projectRoot, files: { "a/../../x": "escape" } })).rejects.toThrow("outside the project root");
	});

	it("refuses an absolute path", async () => {
		await expect(writeProjectFiles({ projectRoot, files: { [join(base, "abs.txt")]: "escape" } })).rejects.toThrow(
			"outside the project root",
		);
	});

	it("refuses a path that is the root itself", async () => {
		await expect(writeProjectFiles({ projectRoot, files: { ".": "x" } })).rejects.toThrow("outside the project root");
	});
});
