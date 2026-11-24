import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import readStored from "./index.js";

const TOKEN = "ab".repeat(32);

describe("readStored", () => {
	let dir: string;
	beforeEach(async () => {
		dir = await mkdtemp(join(tmpdir(), "observer-readstored-"));
	});
	afterEach(async () => {
		await rm(dir, { recursive: true, force: true });
	});

	it("returns null for a missing file", async () => {
		expect(await readStored({ file: join(dir, "absent") })).toBeNull();
	});

	it("returns a well-formed token with its trailing newline trimmed", async () => {
		const file = join(dir, "token");
		await writeFile(file, `${TOKEN}\n`);
		expect(await readStored({ file })).toBe(TOKEN);
	});

	it("returns null for malformed content", async () => {
		const file = join(dir, "token");
		await writeFile(file, "not a token");
		expect(await readStored({ file })).toBeNull();
	});

	it("rethrows other fs errors", async () => {
		await expect(readStored({ file: dir })).rejects.toThrow();
	});
});
