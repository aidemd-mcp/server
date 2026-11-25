import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

vi.mock("../publishCopy/index.js", async (importOriginal) => {
	const actual = await importOriginal<typeof import("../publishCopy/index.js")>();
	return { default: vi.fn(actual.default) };
});

import publishCopy from "../publishCopy/index.js";
import moveRecord from "./index.js";

const mockPublishCopy = vi.mocked(publishCopy);

let folder: string;
let source: string;
let target: string;

async function seed(file: string, content: string): Promise<void> {
	await mkdir(path.dirname(file), { recursive: true });
	await writeFile(file, content);
}

beforeEach(async () => {
	folder = await mkdtemp(path.join(tmpdir(), "aide-moverecord-"));
	source = path.join(folder, "legacy", "presence", "s1.json");
	target = path.join(folder, "new", "presence", "s1.json");
});

afterEach(async () => {
	vi.clearAllMocks();
	await rm(folder, { recursive: true, force: true });
});

describe("moveRecord", () => {
	it("moves a record the new root lacks and removes the source", async () => {
		await seed(source, '{"state":"working"}');
		expect(await moveRecord({ source, target })).toEqual({ outcome: "moved" });
		expect(await readFile(target, "utf8")).toBe('{"state":"working"}');
		expect(existsSync(source)).toBe(false);
		expect(await readdir(path.dirname(target))).toEqual(["s1.json"]);
	});

	it("lets the new root win when it already holds the record", async () => {
		await seed(source, '{"state":"working"}');
		await seed(target, '{"state":"ended"}');
		expect(await moveRecord({ source, target })).toEqual({ outcome: "superseded" });
		expect(await readFile(target, "utf8")).toBe('{"state":"ended"}');
		expect(existsSync(source)).toBe(false);
	});

	it("lets the new root win when a concurrent mover publishes first", async () => {
		await seed(source, '{"state":"working"}');
		mockPublishCopy.mockImplementationOnce(async () => {
			await seed(target, '{"state":"ended"}');
			return "exists";
		});
		expect(await moveRecord({ source, target })).toEqual({ outcome: "superseded" });
		expect(await readFile(target, "utf8")).toBe('{"state":"ended"}');
		expect(existsSync(source)).toBe(false);
	});

	it("leaves the source in place when the publish fails", async () => {
		await seed(source, "{}");
		mockPublishCopy.mockRejectedValueOnce(new Error("disk full"));
		expect(await moveRecord({ source, target })).toEqual({ outcome: "left", reason: "error", detail: "disk full" });
		expect(existsSync(source)).toBe(true);
	});
});
