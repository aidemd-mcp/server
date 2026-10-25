import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, writeFile, rm, mkdir, readdir } from "node:fs/promises";
import { join, isAbsolute } from "node:path";
import { tmpdir } from "node:os";
import planSessionRecord from "./index.js";

const INSTRUCTION =
	'Call aide_scaffold with directory "." and type "session" to create the empty session record at .aide/session.aide.';

let tempDir: string;

beforeEach(async () => {
	tempDir = await mkdtemp(join(tmpdir(), "aide-plan-session-record-"));
});

afterEach(async () => {
	await rm(tempDir, { recursive: true, force: true });
});

async function snapshot(): Promise<string[]> {
	return (await readdir(tempDir, { recursive: true })).sort();
}

describe("planSessionRecord", () => {
	it("returns the content-free would-create step when the record is absent", async () => {
		const before = await snapshot();

		const step = await planSessionRecord(tempDir);

		expect(step).toEqual({
			name: "Session record (session.aide)",
			status: "would-create",
			category: "methodology",
			filePath: join(tempDir, ".aide", "session.aide"),
			instructions: INSTRUCTION,
		});
		expect(step.instructions).toBe(INSTRUCTION);
		expect(step.instructions!.length).toBeLessThan(200);
		expect(step.instructions).not.toContain("@latest");
		expect(step).not.toHaveProperty("content");
		expect(isAbsolute(step.filePath)).toBe(true);
		expect(await snapshot()).toEqual(before);
	});

	it("does not create .aide/ when the record is absent", async () => {
		await planSessionRecord(tempDir);

		expect(await readdir(tempDir)).toEqual([]);
	});

	it("returns exists with neither content nor instructions for a filled record", async () => {
		await mkdir(join(tempDir, ".aide"));
		await writeFile(join(tempDir, ".aide", "session.aide"), "# my filled session\nwork in progress\n");
		const before = await snapshot();

		const step = await planSessionRecord(tempDir);

		expect(step).toEqual({
			name: "Session record (session.aide)",
			status: "exists",
			category: "methodology",
			filePath: join(tempDir, ".aide", "session.aide"),
		});
		expect(step).not.toHaveProperty("content");
		expect(step).not.toHaveProperty("instructions");
		expect(await snapshot()).toEqual(before);
	});

	it("returns exists for a zero-byte record", async () => {
		await mkdir(join(tempDir, ".aide"));
		await writeFile(join(tempDir, ".aide", "session.aide"), "");
		const before = await snapshot();

		const step = await planSessionRecord(tempDir);

		expect(step.status).toBe("exists");
		expect(step).not.toHaveProperty("content");
		expect(step).not.toHaveProperty("instructions");
		expect(await snapshot()).toEqual(before);
	});
});
