import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtemp, writeFile, rm, mkdir, access } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import scaffoldCommands, { COMMANDS } from "./index.js";
import type { InitStep } from "@/types/index.js";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");
const COMMANDS_ROOT = join(REPO_ROOT, ".claude", "commands");

// ---------------------------------------------------------------------------
// Factory helpers
// ---------------------------------------------------------------------------

function makeWouldCreate(name: string, content: string): Partial<InitStep> {
	return { status: "would-create", name, category: "commands", content };
}

function makeExists(name: string): Partial<InitStep> {
	return { status: "exists", name, category: "commands" };
}

function makeWouldOverwrite(name: string, content: string): Partial<InitStep> {
	return { status: "would-overwrite", name, category: "commands", content };
}

// ---------------------------------------------------------------------------
// Temp dir lifecycle
// ---------------------------------------------------------------------------

let tempDir: string;

beforeEach(async () => {
	tempDir = await mkdtemp(join(tmpdir(), "aide-scaffold-"));
});

afterEach(async () => {
	await rm(tempDir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// Core behaviour
// ---------------------------------------------------------------------------

describe("scaffoldCommands", () => {
	it("returns would-create steps for every command in the registry on a cold run", async () => {
		const commandDir = join(tempDir, "commands");

		const results = await scaffoldCommands(commandDir);

		expect(results).toHaveLength(COMMANDS.length);
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
			"aide:update-playbook",
			"aide:refactor",
			"aide:align",
			"aide:brain",
			"aide:handoff",
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

	it("returns would-overwrite for a command that exists on disk with modified content", async () => {
		const commandDir = join(tempDir, "commands");
		await mkdir(join(commandDir, "aide"), { recursive: true });
		await writeFile(join(commandDir, "aide", "qa.md"), "# my custom qa\n", "utf-8");

		const results = await scaffoldCommands(commandDir);

		const byName = new Map(results.map((r) => [r.name, r.status]));
		expect(byName.get("aide:qa")).toBe("would-overwrite");
		expect(byName.get("aide:research")).toBe("would-create");
		expect(byName.get("aide:spec")).toBe("would-create");
		expect(byName.get("aide:plan")).toBe("would-create");
		expect(byName.get("aide:build")).toBe("would-create");
		expect(byName.get("aide:fix")).toBe("would-create");
	});

	it("would-overwrite step carries canonical content", async () => {
		const commandDir = join(tempDir, "commands");
		await mkdir(join(commandDir, "aide"), { recursive: true });
		await writeFile(join(commandDir, "aide", "build.md"), "# my custom build\n", "utf-8");

		const results = await scaffoldCommands(commandDir);

		const build = results.find((r) => r.name === "aide:build");
		const canonicalContent = readFileSync(join(COMMANDS_ROOT, "aide", "build.md"), "utf-8");
		expect(build?.status).toBe("would-overwrite");
		expect(build?.content).toBe(canonicalContent);
	});

	it("returns exists when a command on disk is byte-identical to canonical", async () => {
		const commandDir = join(tempDir, "commands");
		await mkdir(join(commandDir, "aide"), { recursive: true });

		const canonicalResearch = readFileSync(join(COMMANDS_ROOT, "aide", "research.md"), "utf-8");
		await writeFile(join(commandDir, "aide", "research.md"), canonicalResearch, "utf-8");

		const results = await scaffoldCommands(commandDir);

		const byName = new Map(results.map((r) => [r.name, r.status]));
		expect(byName.get("aide:research")).toBe("exists");
		expect(byName.get("aide:spec")).toBe("would-create");
		expect(byName.get("aide:plan")).toBe("would-create");
	});

	it("exists steps have no content field", async () => {
		const commandDir = join(tempDir, "commands");
		await mkdir(join(commandDir, "aide"), { recursive: true });

		const canonicalBuild = readFileSync(join(COMMANDS_ROOT, "aide", "build.md"), "utf-8");
		await writeFile(join(commandDir, "aide", "build.md"), canonicalBuild, "utf-8");

		const results = await scaffoldCommands(commandDir);

		const build = results.find((r) => r.name === "aide:build");
		expect(build?.status).toBe("exists");
		expect(build?.content).toBeUndefined();
	});

	it("partial-overwrite scenario: one drifted command among many absent ones → that step is would-overwrite, others are would-create", async () => {
		const commandDir = join(tempDir, "commands");
		await mkdir(join(commandDir, "aide"), { recursive: true });
		// Pre-write research.md with modified content (simulating user customisation)
		await writeFile(join(commandDir, "aide", "research.md"), "# my custom research steps\n", "utf-8");

		const results = await scaffoldCommands(commandDir);

		expect(results).toHaveLength(COMMANDS.length);
		const byName = new Map(results.map((r) => [r.name, r.status]));
		expect(byName.get("aide:research")).toBe("would-overwrite");
		// All other commands are absent → would-create
		expect(byName.get("aide:spec")).toBe("would-create");
		expect(byName.get("aide:plan")).toBe("would-create");
		expect(byName.get("aide:build")).toBe("would-create");
		expect(byName.get("aide:qa")).toBe("would-create");
		expect(byName.get("aide:fix")).toBe("would-create");
		expect(byName.get("aide:update-playbook")).toBe("would-create");
		expect(byName.get("aide:refactor")).toBe("would-create");
		expect(byName.get("aide:align")).toBe("would-create");
		expect(byName.get("aide:upgrade")).toBe("would-create");
		expect(byName.get("aide:synthesize")).toBe("would-create");
		expect(byName.get("aide")).toBe("would-create");
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
		vi.doMock("@/service/install/initContent/index.js", () => ({
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

		expect(results).toHaveLength(COMMANDS.length);
		const byName = new Map(results.map((r) => [r.name, r.status]));
		expect(byName.get("aide:build")).toBe("would-skip");
		expect(byName.get("aide:research")).toBe("would-create");
		expect(byName.get("aide:spec")).toBe("would-create");
		expect(byName.get("aide:plan")).toBe("would-create");
		expect(byName.get("aide:qa")).toBe("would-create");
		expect(byName.get("aide:fix")).toBe("would-create");

		vi.doUnmock("@/service/install/initContent/index.js");
		vi.resetModules();
	});
});

// ---------------------------------------------------------------------------
// Parameterized: all three outcome shapes
// ---------------------------------------------------------------------------

describe("scaffoldCommands — parameterized outcome shapes", () => {
	it.each([
		["aide", "aide.md"] as const,
		["aide:research", "aide/research.md"] as const,
		["aide:build", "aide/build.md"] as const,
	])("missing %s → would-create with content", async (displayName, relPath) => {
		const commandDir = join(tempDir, "commands");

		const results = await scaffoldCommands(commandDir);
		const step = results.find((r) => r.name === displayName)!;

		const canonical = readFileSync(join(COMMANDS_ROOT, relPath), "utf-8");
		expect(step).toMatchObject(makeWouldCreate(displayName, canonical));
	});

	it.each([
		["aide:research", "aide/research.md"] as const,
		["aide:build", "aide/build.md"] as const,
	])("byte-identical %s on disk → exists with no content", async (displayName, relPath) => {
		const commandDir = join(tempDir, "commands");
		await mkdir(join(commandDir, "aide"), { recursive: true });

		const canonicalContent = readFileSync(join(COMMANDS_ROOT, relPath), "utf-8");
		await writeFile(join(commandDir, relPath), canonicalContent, "utf-8");

		const results = await scaffoldCommands(commandDir);
		const step = results.find((r) => r.name === displayName)!;

		expect(step).toMatchObject(makeExists(displayName));
		expect(step.content).toBeUndefined();
	});

	it.each([
		["aide:research", "aide/research.md"] as const,
		["aide:build", "aide/build.md"] as const,
	])("drifted %s on disk → would-overwrite with canonical content", async (displayName, relPath) => {
		const commandDir = join(tempDir, "commands");
		await mkdir(join(commandDir, "aide"), { recursive: true });
		await writeFile(join(commandDir, relPath), `# stale content for ${displayName}\n`, "utf-8");

		const results = await scaffoldCommands(commandDir);
		const step = results.find((r) => r.name === displayName)!;

		const canonical = readFileSync(join(COMMANDS_ROOT, relPath), "utf-8");
		expect(step).toMatchObject(makeWouldOverwrite(displayName, canonical));
	});
});
