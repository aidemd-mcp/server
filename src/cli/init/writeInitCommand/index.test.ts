import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import writeInitCommand from "./index.js";
import { readCanonicalDoc } from "@/tools/init/initContent/index.js";

let tempDir: string;

beforeEach(async () => {
	tempDir = await mkdtemp(join(tmpdir(), "aide-writeinitcmd-"));
});

afterEach(async () => {
	await rm(tempDir, { recursive: true, force: true });
});

describe("writeInitCommand", () => {
	it("writes the init command file when it does not exist and content matches readCanonicalDoc", async () => {
		const result = await writeInitCommand(tempDir);

		expect(result.status).toBe("created");

		const commandPath = join(
			tempDir,
			".claude",
			"commands",
			"aide",
			"init.md",
		);
		const written = await readFile(commandPath, "utf-8");
		const expected = readCanonicalDoc("commands/aide/init");

		expect(written).toBe(expected);
	});

	it("creates the full parent directory tree when it does not exist", async () => {
		// The tempDir has no .claude/commands/aide/ hierarchy — confirm it is
		// created successfully without throwing
		const result = await writeInitCommand(tempDir);

		expect(result.status).toBe("created");

		const commandPath = join(
			tempDir,
			".claude",
			"commands",
			"aide",
			"init.md",
		);
		// readFile throws if the file or any ancestor dir was not created
		const written = await readFile(commandPath, "utf-8");
		expect(written.length).toBeGreaterThan(0);
	});

	it("returns exists without modifying the file when it already exists on disk", async () => {
		const commandPath = join(
			tempDir,
			".claude",
			"commands",
			"aide",
			"init.md",
		);

		// Pre-create the directory tree and the file with sentinel content
		const { mkdir } = await import("node:fs/promises");
		await mkdir(join(tempDir, ".claude", "commands", "aide"), {
			recursive: true,
		});
		const sentinel = "# existing content — must not be overwritten";
		await writeFile(commandPath, sentinel, "utf-8");

		const result = await writeInitCommand(tempDir);

		expect(result.status).toBe("exists");

		// File content must be unchanged
		const after = await readFile(commandPath, "utf-8");
		expect(after).toBe(sentinel);
	});
});
