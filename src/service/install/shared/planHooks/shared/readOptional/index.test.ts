import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import readOptional from "./index.js";

let root: string;

beforeEach(async () => {
	root = await mkdtemp(join(tmpdir(), "aide-read-optional-"));
});

afterEach(async () => {
	await rm(root, { recursive: true, force: true });
});

describe("readOptional", () => {
	it("returns the file's text when it exists", async () => {
		const path = join(root, "settings.json");
		await writeFile(path, "{ \"a\": 1 }\r\n", "utf-8");
		expect(await readOptional(path)).toBe("{ \"a\": 1 }\r\n");
	});

	it("returns null when the file does not exist", async () => {
		expect(await readOptional(join(root, "missing.json"))).toBeNull();
	});

	it("rethrows any error other than a missing file", async () => {
		const path = join(root, "a-directory");
		await mkdir(path);
		await expect(readOptional(path)).rejects.toMatchObject({ code: "EISDIR" });
	});
});
