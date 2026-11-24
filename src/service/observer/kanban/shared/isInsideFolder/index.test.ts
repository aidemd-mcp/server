import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import isInsideFolder from "./index.js";

let root: string;

beforeEach(async () => {
	root = await mkdtemp(join(tmpdir(), "inside-folder-"));
});

afterEach(async () => {
	await rm(root, { recursive: true, force: true });
});

describe("isInsideFolder", () => {
	it("is true for a file in a subfolder", async () => {
		await mkdir(join(root, "board", "todo"), { recursive: true });
		await writeFile(join(root, "board", "todo", "a.md"), "x");
		expect(await isInsideFolder({ folder: join(root, "board"), path: join(root, "board", "todo", "a.md") })).toBe(true);
	});

	it("is false for the folder itself", async () => {
		await mkdir(join(root, "board"));
		expect(await isInsideFolder({ folder: join(root, "board"), path: join(root, "board") })).toBe(false);
	});

	it("is false for a sibling whose name starts with the folder's name", async () => {
		await mkdir(join(root, "board"));
		await mkdir(join(root, "board-x"));
		await writeFile(join(root, "board-x", "a.md"), "x");
		expect(await isInsideFolder({ folder: join(root, "board"), path: join(root, "board-x", "a.md") })).toBe(false);
	});

	it("is false for a missing path", async () => {
		await mkdir(join(root, "board"));
		expect(await isInsideFolder({ folder: join(root, "board"), path: join(root, "board", "nope.md") })).toBe(false);
	});

	it("is false for a symlink inside the folder pointing outside", async (context) => {
		await mkdir(join(root, "board"));
		await writeFile(join(root, "secret.md"), "x");
		try {
			await symlink(join(root, "secret.md"), join(root, "board", "link.md"));
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code === "EPERM") return context.skip();
			throw error;
		}
		expect(await isInsideFolder({ folder: join(root, "board"), path: join(root, "board", "link.md") })).toBe(false);
	});
});
