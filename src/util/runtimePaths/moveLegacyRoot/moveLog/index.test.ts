import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { existsSync } from "node:fs";
import { appendFile, mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

vi.mock("../publishCopy/index.js", async (importOriginal) => {
	const actual = await importOriginal<typeof import("../publishCopy/index.js")>();
	return { default: vi.fn(actual.default) };
});

import publishCopy from "../publishCopy/index.js";
import moveLog from "./index.js";

const mockPublishCopy = vi.mocked(publishCopy);

let folder: string;
let source: string;
let target: string;

async function makeLegacyLog(content: string): Promise<void> {
	await mkdir(path.dirname(source), { recursive: true });
	await writeFile(source, content);
}

async function makeTargetLog(content: string): Promise<void> {
	await mkdir(path.dirname(target), { recursive: true });
	await writeFile(target, content);
}

beforeEach(async () => {
	folder = await mkdtemp(path.join(tmpdir(), "aide-movelog-"));
	source = path.join(folder, "legacy", "events", "s1.jsonl");
	target = path.join(folder, "new", "events", "s1.jsonl");
});

afterEach(async () => {
	vi.clearAllMocks();
	await rm(folder, { recursive: true, force: true });
});

describe("moveLog", () => {
	it("moves a log the new root lacks: copied whole, source gone", async () => {
		await makeLegacyLog("a\nb\n");
		expect(await moveLog({ source, target })).toEqual({ outcome: "moved" });
		expect(await readFile(target, "utf8")).toBe("a\nb\n");
		expect(existsSync(source)).toBe(false);
		expect(await readdir(path.dirname(target))).toEqual(["s1.jsonl"]);
	});

	it("supersedes a log the new root already holds identically", async () => {
		await makeLegacyLog("a\nb\n");
		await makeTargetLog("a\nb\n");
		expect(await moveLog({ source, target })).toEqual({ outcome: "superseded" });
		expect(existsSync(source)).toBe(false);
		expect(await readFile(target, "utf8")).toBe("a\nb\n");
	});

	it("republishes a source that grew after an earlier copy", async () => {
		await makeLegacyLog("a\nb\nc\n");
		await makeTargetLog("a\n");
		expect(await moveLog({ source, target })).toEqual({ outcome: "moved" });
		expect(await readFile(target, "utf8")).toBe("a\nb\nc\n");
		expect(existsSync(source)).toBe(false);
	});

	it("supersedes a source the new root is already ahead of", async () => {
		await makeLegacyLog("a\n");
		await makeTargetLog("a\nb\n");
		expect(await moveLog({ source, target })).toEqual({ outcome: "superseded" });
		expect(existsSync(source)).toBe(false);
		expect(await readFile(target, "utf8")).toBe("a\nb\n");
		expect(mockPublishCopy).not.toHaveBeenCalled();
	});

	it("leaves a diverged log with both files intact", async () => {
		await makeLegacyLog("a\nb\n");
		await makeTargetLog("a\nc\n");
		expect(await moveLog({ source, target })).toEqual({ outcome: "left", reason: "diverged" });
		expect(await readFile(source, "utf8")).toBe("a\nb\n");
		expect(await readFile(target, "utf8")).toBe("a\nc\n");
	});

	it("leaves a source that changes between the copy and the release as changed, still present", async () => {
		await makeLegacyLog("a\n");
		const actual = (await vi.importActual<typeof import("../publishCopy/index.js")>("../publishCopy/index.js")).default;
		mockPublishCopy.mockImplementationOnce(async (input) => {
			const answer = await actual(input);
			await appendFile(source, "b\n");
			return answer;
		});

		expect(await moveLog({ source, target })).toEqual({ outcome: "left", reason: "changed" });
		expect(await readFile(source, "utf8")).toBe("a\nb\n");
		expect(await readFile(target, "utf8")).toBe("a\n");
	});

	it("leaves the source in place when the publish fails", async () => {
		await makeLegacyLog("a\n");
		mockPublishCopy.mockRejectedValueOnce(new Error("disk full"));

		expect(await moveLog({ source, target })).toEqual({ outcome: "left", reason: "error", detail: "disk full" });
		expect(await readFile(source, "utf8")).toBe("a\n");
		expect(existsSync(target)).toBe(false);
	});

	it("supersedes a source another mover already took", async () => {
		await makeTargetLog("a\n");
		expect(await moveLog({ source, target })).toEqual({ outcome: "superseded" });
		expect(await readFile(target, "utf8")).toBe("a\n");
	});
});
