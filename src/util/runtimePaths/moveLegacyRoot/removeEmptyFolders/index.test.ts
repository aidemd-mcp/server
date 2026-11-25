import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import removeEmptyFolders from "./index.js";

let folder: string;

beforeEach(async () => {
	folder = await mkdtemp(path.join(tmpdir(), "aide-rmdir-"));
});

afterEach(async () => {
	await rm(folder, { recursive: true, force: true });
});

describe("removeEmptyFolders", () => {
	it("removes empty folders in the given order, children before parents", async () => {
		await mkdir(path.join(folder, "a", "b"), { recursive: true });
		await removeEmptyFolders({ folders: [path.join(folder, "a", "b"), path.join(folder, "a")] });
		expect(existsSync(path.join(folder, "a"))).toBe(false);
	});

	it("keeps a folder that still holds a file and ignores a missing folder", async () => {
		await mkdir(path.join(folder, "full"), { recursive: true });
		await writeFile(path.join(folder, "full", "keep.txt"), "x");
		await removeEmptyFolders({ folders: [path.join(folder, "full"), path.join(folder, "missing")] });
		expect(existsSync(path.join(folder, "full", "keep.txt"))).toBe(true);
	});
});
