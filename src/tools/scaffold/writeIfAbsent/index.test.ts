import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import writeIfAbsent from "./index.js";

let tempDir: string;

beforeEach(async () => {
	tempDir = await mkdtemp(join(tmpdir(), "aide-write-if-absent-"));
});

afterEach(async () => {
	await rm(tempDir, { recursive: true, force: true });
});

describe("writeIfAbsent", () => {
	it("creates an absent target with the exact bytes", async () => {
		const target = join(tempDir, "new.aide");

		const outcome = await writeIfAbsent(target, "line one\nline two\n");

		expect(outcome).toBe("created");
		expect(await readFile(target, "utf-8")).toBe("line one\nline two\n");
	});

	it("leaves an existing filled target untouched", async () => {
		const target = join(tempDir, "filled.aide");
		await writeFile(target, "original");

		const outcome = await writeIfAbsent(target, "replacement");

		expect(outcome).toBe("exists");
		expect(await readFile(target, "utf-8")).toBe("original");
	});

	it("leaves an existing empty target empty", async () => {
		const target = join(tempDir, "empty.aide");
		await writeFile(target, "");

		const outcome = await writeIfAbsent(target, "replacement");

		expect(outcome).toBe("exists");
		expect(await readFile(target, "utf-8")).toBe("");
	});

	it("rejects with ENOENT when the parent directory is missing", async () => {
		const target = join(tempDir, "missing", "new.aide");

		await expect(writeIfAbsent(target, "content")).rejects.toMatchObject({
			code: "ENOENT",
		});
	});
});
