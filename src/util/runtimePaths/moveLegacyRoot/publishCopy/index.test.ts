import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import publishCopy from "./index.js";

let folder: string;
let source: string;
let target: string;

beforeEach(async () => {
	folder = await mkdtemp(path.join(tmpdir(), "aide-publish-"));
	source = path.join(folder, "old", "log.jsonl");
	target = path.join(folder, "new", "nested", "log.jsonl");
	await mkdir(path.dirname(source), { recursive: true });
	await writeFile(source, "source bytes\n");
});

afterEach(async () => {
	await rm(folder, { recursive: true, force: true });
});

describe("publishCopy", () => {
	it("creates the target folder and publishes a whole copy, leaving the source and no temp", async () => {
		expect(await publishCopy({ source, target, replace: false })).toBe("published");
		expect(await readFile(target, "utf8")).toBe("source bytes\n");
		expect(await readFile(source, "utf8")).toBe("source bytes\n");
		expect(await readdir(path.dirname(target))).toEqual(["log.jsonl"]);
	});

	it("answers exists and keeps the target's bytes when not replacing", async () => {
		await publishCopy({ source, target, replace: false });
		await writeFile(target, "newer bytes\n");
		expect(await publishCopy({ source, target, replace: false })).toBe("exists");
		expect(await readFile(target, "utf8")).toBe("newer bytes\n");
		expect(await readdir(path.dirname(target))).toEqual(["log.jsonl"]);
	});

	it("replaces the target when asked, leaving no temp", async () => {
		await publishCopy({ source, target, replace: false });
		await writeFile(target, "short");
		expect(await publishCopy({ source, target, replace: true })).toBe("published");
		expect(await readFile(target, "utf8")).toBe("source bytes\n");
		expect(await readdir(path.dirname(target))).toEqual(["log.jsonl"]);
	});

	it("throws on a missing source and leaves no temp behind", async () => {
		await expect(publishCopy({ source: path.join(folder, "nope"), target, replace: false })).rejects.toThrow();
		expect(await readdir(path.dirname(target))).toEqual([]);
	});
});
