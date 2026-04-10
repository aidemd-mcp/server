import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, writeFile, readdir, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import scaffoldCommands from "./index.js";

let tempDir: string;

beforeEach(async () => {
	tempDir = await mkdtemp(join(tmpdir(), "aide-scaffold-"));
});

afterEach(async () => {
	await rm(tempDir, { recursive: true, force: true });
});

describe("scaffoldCommands", () => {
	it("creates all 5 command files in a fresh directory", async () => {
		const commandDir = join(tempDir, "commands");

		const results = await scaffoldCommands(commandDir);

		const files = await readdir(commandDir);
		expect(files).toContain("aide-research.md");
		expect(files).toContain("aide-spec.md");
		expect(files).toContain("aide-build.md");
		expect(files).toContain("aide-qa.md");
		expect(files).toContain("aide-fix.md");
		expect(results.every((r) => r.status === "created")).toBe(true);
	});

	it("leaves existing command files untouched", async () => {
		const commandDir = join(tempDir, "commands");
		await scaffoldCommands(commandDir);
		const customContent = "# Customized\n";
		await writeFile(join(commandDir, "aide-build.md"), customContent, "utf-8");

		const results = await scaffoldCommands(commandDir);

		const contents = await readFile(join(commandDir, "aide-build.md"), "utf-8");
		expect(contents).toBe(customContent);
		expect(results.find((r) => r.name === "aide-build")?.status).toBe("exists");
	});
});
