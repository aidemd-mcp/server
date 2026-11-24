import { mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import removeRecord from "./index.js";

let folder: string;
let observerFile: string;

async function exists(file: string): Promise<boolean> {
	return stat(file).then(
		() => true,
		() => false,
	);
}

async function seed({ pid, token }: { pid: number; token: string }): Promise<void> {
	await writeFile(observerFile, JSON.stringify({ address: "http://127.0.0.1:4000", token, pid, version: "1.0.0" }));
}

beforeEach(async () => {
	folder = await mkdtemp(join(tmpdir(), "aide-remove-record-"));
	observerFile = join(folder, "observer.json");
});

afterEach(async () => {
	await rm(folder, { recursive: true, force: true });
});

describe("removeRecord", () => {
	it("removes a record naming this pid and token", async () => {
		await seed({ pid: process.pid, token: "mine" });
		await removeRecord({ observerFile, pid: process.pid, token: "mine" });
		expect(await exists(observerFile)).toBe(false);
	});

	it("leaves a record with another token", async () => {
		await seed({ pid: process.pid, token: "theirs" });
		await removeRecord({ observerFile, pid: process.pid, token: "mine" });
		expect(await exists(observerFile)).toBe(true);
	});

	it("leaves a record with another pid", async () => {
		await seed({ pid: process.pid, token: "mine" });
		await removeRecord({ observerFile, pid: process.pid + 1, token: "mine" });
		expect(await exists(observerFile)).toBe(true);
	});

	it("is quiet when the file is gone", async () => {
		await expect(removeRecord({ observerFile, pid: process.pid, token: "mine" })).resolves.toBeUndefined();
	});
});
