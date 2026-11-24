import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import writeRecord from "./index.js";

let folder: string;

beforeEach(async () => {
	folder = await mkdtemp(join(tmpdir(), "aide-write-record-"));
});

afterEach(async () => {
	await rm(folder, { recursive: true, force: true });
});

describe("writeRecord", () => {
	it("writes the record as JSON", async () => {
		const observerFile = join(folder, "observer.json");
		const record = { address: "http://127.0.0.1:4000", token: "tok", pid: 123, version: "1.0.0" };
		await writeRecord({ observerFile, record });
		expect(JSON.parse(await readFile(observerFile, "utf-8"))).toEqual(record);
	});

	it("replaces an existing file and leaves no .tmp behind", async () => {
		const observerFile = join(folder, "observer.json");
		await writeFile(observerFile, "old");
		const record = { address: "http://127.0.0.1:4001", token: "new", pid: 456, version: "1.0.0" };
		await writeRecord({ observerFile, record });
		expect(JSON.parse(await readFile(observerFile, "utf-8"))).toEqual(record);
		expect(await readdir(folder)).toEqual(["observer.json"]);
	});
});
