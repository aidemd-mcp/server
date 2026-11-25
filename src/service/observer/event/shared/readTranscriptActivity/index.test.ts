import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import readTranscriptActivity from "./index.js";

let folder: string;

beforeEach(async () => {
	folder = await mkdtemp(path.join(tmpdir(), "aide-transcript-"));
});

afterEach(async () => {
	await rm(folder, { recursive: true, force: true });
});

describe("readTranscriptActivity", () => {
	it("answers the file's last-write time as an ISO string", async () => {
		const file = path.join(folder, "t.jsonl");
		await writeFile(file, "secret content", "utf-8");
		const when = new Date("2026-11-25T09:30:00.000Z");
		await utimes(file, when, when);

		expect(await readTranscriptActivity({ transcriptPath: file })).toBe("2026-11-25T09:30:00.000Z");
	});

	it("answers null for an undefined path", async () => {
		expect(await readTranscriptActivity({ transcriptPath: undefined })).toBeNull();
	});

	it("answers null for a missing file", async () => {
		expect(await readTranscriptActivity({ transcriptPath: path.join(folder, "missing.jsonl") })).toBeNull();
	});

	it("answers null for a path that cannot be statted", async () => {
		expect(await readTranscriptActivity({ transcriptPath: "\0bad" })).toBeNull();
	});
});
