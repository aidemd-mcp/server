import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtemp, writeFile, rm, mkdir, access } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import scaffoldCommands from "./index.js";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");
const COMMANDS_ROOT = join(REPO_ROOT, ".claude", "commands");

let tempDir: string;

beforeEach(async () => {
	tempDir = await mkdtemp(join(tmpdir(), "aide-scaffold-"));
});

afterEach(async () => {
	await rm(tempDir, { recursive: true, force: true });
});

describe("scaffoldCommands", () => {
	it("returns would-create steps for all 10 commands on a cold run", async () => {
		const commandDir = join(tempDir, "commands");

		const results = await scaffoldCommands(commandDir);

		expect(results).toHaveLength(10);
		expect(results.every((r) => r.status === "would-create")).toBe(true);
		expect(results.map((r) => r.name)).toEqual([
			"aide",
			"aide:research",
			"aide:spec",
			"aide:synthesize",
			"aide:plan",
			"aide:build",
			"aide:qa",
			"aide:fix",
			"aide:upgrade",
			"aide:init",
		]);
	});

	it("would-create steps carry content matching canonical docs", async () => {
		const commandDir = join(tempDir, "commands");

		const results = await scaffoldCommands(commandDir);

		// Orchestrator
		const orchestrator = results.find((r) => r.name === "aide");
		const canonicalOrchestrator = readFileSync(join(COMMANDS_ROOT, "aide.md"), "utf-8");
		expect(orchestrator?.content).toBe(canonicalOrchestrator);

		// Phase command
		const research = results.find((r) => r.name === "aide:research");
		const canonicalResearch = readFileSync(join(COMMANDS_ROOT, "aide", "research.md"), "utf-8");
		expect(research?.content).toBe(canonicalResearch);
	});

	it("returns exists for commands that already exist on disk", async () => {
		const commandDir = join(tempDir, "commands");
		await mkdir(join(commandDir, "aide"), { recursive: true });
		await writeFile(join(commandDir, "aide", "qa.md"), "# mine\n", "utf-8");

		const results = await scaffoldCommands(commandDir);

		const byName = new Map(results.map((r) => [r.name, r.status]));
		expect(byName.get("aide:qa")).toBe("exists");
		expect(byName.get("aide:research")).toBe("would-create");
		expect(byName.get("aide:spec")).toBe("would-create");
		expect(byName.get("aide:plan")).toBe("would-create");
		expect(byName.get("aide:build")).toBe("would-create");
		expect(byName.get("aide:fix")).toBe("would-create");
	});

	it("exists steps have no content field", async () => {
		const commandDir = join(tempDir, "commands");
		await mkdir(join(commandDir, "aide"), { recursive: true });
		await writeFile(join(commandDir, "aide", "build.md"), "# custom\n", "utf-8");

		const results = await scaffoldCommands(commandDir);

		const build = results.find((r) => r.name === "aide:build");
		expect(build?.status).toBe("exists");
		expect(build?.content).toBeUndefined();
	});

	it("category is 'commands' for all steps", async () => {
		const commandDir = join(tempDir, "commands");

		const results = await scaffoldCommands(commandDir);

		expect(results.every((r) => r.category === "commands")).toBe(true);
	});

	it("never writes to disk", async () => {
		const commandDir = join(tempDir, "commands");

		await scaffoldCommands(commandDir);

		await expect(access(commandDir)).rejects.toThrow();
	});

	it("does not cascade when one canonical template read fails — returns would-skip for that entry", async () => {
		const commandDir = join(tempDir, "commands");
		const failingCanonical = "commands/aide/build";

		vi.resetModules();
		vi.doMock("@/tools/init/initContent/index.js", () => ({
			readCanonicalDoc: (name: string) => {
				if (name === failingCanonical) {
					throw new Error(`initContent: canonical doc "${name}" not readable`);
				}
				return `mocked content for ${name}\n`;
			},
			COMMANDS: undefined, // not used by scaffoldCommands directly
		}));

		const { default: scaffoldCommandsFresh } = await import("./index.js");
		const results = await scaffoldCommandsFresh(commandDir);

		expect(results).toHaveLength(10);
		const byName = new Map(results.map((r) => [r.name, r.status]));
		expect(byName.get("aide:build")).toBe("would-skip");
		expect(byName.get("aide:research")).toBe("would-create");
		expect(byName.get("aide:spec")).toBe("would-create");
		expect(byName.get("aide:plan")).toBe("would-create");
		expect(byName.get("aide:qa")).toBe("would-create");
		expect(byName.get("aide:fix")).toBe("would-create");
		expect(byName.get("aide:init")).toBe("would-create");

		vi.doUnmock("@/tools/init/initContent/index.js");
		vi.resetModules();
	});
});
