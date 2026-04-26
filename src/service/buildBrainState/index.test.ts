/**
 * Tests for buildBrainState — the five-state brain precondition detector.
 *
 * INVARIANT (4l): This file MUST NOT import from `@/service/brainBackends`.
 * The detector never calls resolveBackend or any registry function; importing
 * that module here would re-introduce the anti-pattern the spec explicitly
 * retired. If you find yourself reaching for brainBackends in a test, stop —
 * the test design is wrong.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

// Mock only the two I/O helpers whose output the detector consumes structurally.
// parseBrainAide, stat, and readFile operate on real temp files — no fs mocking.
vi.mock("@/service/install/detectFramework/index.js");
vi.mock("@/service/install/resolveBrainHints/index.js");

import detectFramework from "@/service/install/detectFramework/index.js";
import resolveBrainHints from "@/service/install/resolveBrainHints/index.js";
import buildBrainState from "@/service/buildBrainState/index.js";

const mockDetectFramework = detectFramework as ReturnType<typeof vi.fn>;
const mockResolveBrainHints = resolveBrainHints as ReturnType<typeof vi.fn>;

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

/** Minimal valid brain.aide content. rootPath and mcpServerConfig.args use ${rootPath}
 *  so that interpolateArgs substitutes the actual temp directory at comparison time.
 *  connector and entryFile are fixed for most tests; individual tests may override. */
function makeBrainAideContent({
	connector = "obsidian",
	rootPath,
	entryFile = "START HERE.md",
	command = "npx",
	args,
}: {
	connector?: string;
	rootPath: string;
	entryFile?: string;
	command?: string;
	args?: string[];
}): string {
	const resolvedArgs = args ?? ["-y", "obsidian-mcp", "${rootPath}"];
	const argsYaml = resolvedArgs.map((a) => `    - "${a}"`).join("\n");
	return [
		"---",
		`connector: ${connector}`,
		`rootPath: ${rootPath}`,
		`entryFile: ${entryFile}`,
		"mcpServerConfig:",
		`  command: ${command}`,
		"  args:",
		argsYaml,
		"tools:",
		'  read: "mcp__obsidian__read_note"',
		'  search: "mcp__obsidian__search_notes"',
		"---",
		"",
		"## Prose",
		"",
		"This is the hand-written prose the agent receives verbatim.",
	].join("\n");
}

/** Build a .mcp.json whose mcpServers.brain entry matches an interpolated
 *  brain.aide config exactly — produces the `ok` case by construction. */
function makeMcpJson(brainEntry: { command: string; args: string[] }): string {
	return JSON.stringify({ mcpServers: { brain: brainEntry } }, null, 2);
}

/** The framework config the detector uses to locate .mcp.json. */
const FIXED_FRAMEWORK_CONFIG = {
	framework: "claude" as const,
	configPath: "CLAUDE.md",
	commandDir: ".claude/commands",
	mcpConfigPath: ".mcp.json",
	docHubDir: ".aide/docs",
	agentDir: ".claude/agents",
	skillDir: ".claude/skills",
};

// ---------------------------------------------------------------------------
// Test setup
// ---------------------------------------------------------------------------

let tempRoot: string;

beforeEach(async () => {
	vi.resetAllMocks();
	mockDetectFramework.mockResolvedValue(FIXED_FRAMEWORK_CONFIG);
	mockResolveBrainHints.mockResolvedValue([]);

	// Each test gets an isolated temp directory as the project root.
	tempRoot = await mkdtemp(join(tmpdir(), "buildBrainState-test-"));
	// Ensure .aide/ exists so brain.aide can be written into it.
	await mkdir(join(tempRoot, ".aide"), { recursive: true });
});

afterEach(async () => {
	await rm(tempRoot, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// Helper: write brain.aide into tempRoot
// ---------------------------------------------------------------------------

async function writeBrainAide(content: string): Promise<void> {
	await writeFile(join(tempRoot, ".aide", "brain.aide"), content, "utf-8");
}

async function writeMcpJson(content: string): Promise<void> {
	await writeFile(join(tempRoot, ".mcp.json"), content, "utf-8");
}

// ---------------------------------------------------------------------------
// 4a. ok — brain.aide valid, rootPath exists, .mcp.json matches exactly.
// ---------------------------------------------------------------------------

describe("buildBrainState — ok state (4a)", () => {
	it("returns ok with rootPath and connector when brain.aide is valid and .mcp.json matches", async () => {
		// tempRoot IS the vault directory for this test — it already exists.
		const vaultPath = tempRoot;

		await writeBrainAide(
			makeBrainAideContent({ connector: "obsidian", rootPath: vaultPath }),
		);
		// interpolateArgs substitutes ${rootPath} → vaultPath
		await writeMcpJson(
			makeMcpJson({ command: "npx", args: ["-y", "obsidian-mcp", vaultPath] }),
		);

		const result = await buildBrainState(tempRoot);

		expect(result.status).toBe("ok");
		if (result.status === "ok") {
			expect(result.rootPath).toBe(vaultPath);
			expect(result.connector).toBe("obsidian");
			expect(result.hints).toEqual([]);
		}
		// The backend field must not exist anywhere on the returned shape.
		expect(result).not.toHaveProperty("backend");
	});
});

// ---------------------------------------------------------------------------
// 4b. no-brain-aide — brain.aide file is missing entirely.
// ---------------------------------------------------------------------------

describe("buildBrainState — no-brain-aide: file missing (4b)", () => {
	it("returns no-brain-aide when .aide/brain.aide does not exist", async () => {
		// No brain.aide written — tempRoot/.aide/ exists but brain.aide is absent.
		const result = await buildBrainState(tempRoot);

		expect(result.status).toBe("no-brain-aide");
		expect(result).not.toHaveProperty("rootPath");
		expect(result).not.toHaveProperty("connector");
		expect(result).not.toHaveProperty("backend");
	});
});

// ---------------------------------------------------------------------------
// 4c. no-brain-aide — brain.aide exists but frontmatter is malformed YAML.
// ---------------------------------------------------------------------------

describe("buildBrainState — no-brain-aide: frontmatter malformed (4c)", () => {
	it("returns no-brain-aide when brain.aide contains broken YAML frontmatter", async () => {
		await writeBrainAide(
			[
				"---",
				"connector: obsidian",
				"rootPath: [this is: broken: yaml: {",
				"---",
				"",
				"## Prose",
				"content",
			].join("\n"),
		);

		const result = await buildBrainState(tempRoot);

		expect(result.status).toBe("no-brain-aide");
		expect(result).not.toHaveProperty("rootPath");
		expect(result).not.toHaveProperty("connector");
		expect(result).not.toHaveProperty("backend");
	});
});

// ---------------------------------------------------------------------------
// 4d. no-brain-aide — brain.aide has valid frontmatter but no ## Prose heading.
// ---------------------------------------------------------------------------

describe("buildBrainState — no-brain-aide: body malformed (4d)", () => {
	it("returns no-brain-aide when brain.aide has valid frontmatter but missing ## Prose section", async () => {
		const vaultPath = tempRoot;
		// Valid frontmatter — all required fields present — but the body has no
		// ## Prose heading, which parseBrainAide reports as malformed-body.
		await writeBrainAide(
			[
				"---",
				`connector: obsidian`,
				`rootPath: ${vaultPath}`,
				`entryFile: START HERE.md`,
				"mcpServerConfig:",
				"  command: npx",
				"  args:",
				'    - "-y"',
				'    - "obsidian-mcp"',
				'    - "${rootPath}"',
				"tools:",
				'  read: "mcp__obsidian__read_note"',
				'  search: "mcp__obsidian__search_notes"',
				"---",
				"",
				"This body has no Prose heading, only free text.",
			].join("\n"),
		);

		const result = await buildBrainState(tempRoot);

		expect(result.status).toBe("no-brain-aide");
		expect(result).not.toHaveProperty("rootPath");
		expect(result).not.toHaveProperty("connector");
		expect(result).not.toHaveProperty("backend");
	});
});

// ---------------------------------------------------------------------------
// 4e. invalid-path — rootPath does not exist on disk.
// ---------------------------------------------------------------------------

describe("buildBrainState — invalid-path: rootPath missing (4e)", () => {
	it("returns invalid-path when brain.aide rootPath points at a non-existent directory", async () => {
		const brokenPath = join(tempRoot, "this-directory-does-not-exist");

		await writeBrainAide(
			makeBrainAideContent({ connector: "obsidian", rootPath: brokenPath }),
		);

		const result = await buildBrainState(tempRoot);

		expect(result.status).toBe("invalid-path");
		if (result.status === "invalid-path") {
			expect(result.rootPath).toBe(brokenPath);
			expect(result.connector).toBe("obsidian");
		}
		expect(result).not.toHaveProperty("backend");
	});
});

// ---------------------------------------------------------------------------
// 4f. invalid-path — rootPath points at a file, not a directory.
// ---------------------------------------------------------------------------

describe("buildBrainState — invalid-path: rootPath is a file (4f)", () => {
	it("returns invalid-path when brain.aide rootPath points at a file", async () => {
		// Write a file at the path the brain.aide will declare.
		const filePath = join(tempRoot, "not-a-directory.txt");
		await writeFile(filePath, "I am a file, not a vault", "utf-8");

		await writeBrainAide(
			makeBrainAideContent({ connector: "obsidian", rootPath: filePath }),
		);

		const result = await buildBrainState(tempRoot);

		expect(result.status).toBe("invalid-path");
		if (result.status === "invalid-path") {
			expect(result.rootPath).toBe(filePath);
			expect(result.connector).toBe("obsidian");
		}
		expect(result).not.toHaveProperty("backend");
	});
});

// ---------------------------------------------------------------------------
// 4g. no-mcp-entry — brain.aide valid, rootPath exists, .mcp.json absent.
// ---------------------------------------------------------------------------

describe("buildBrainState — no-mcp-entry: .mcp.json missing (4g)", () => {
	it("returns no-mcp-entry with rootPath and connector when .mcp.json does not exist", async () => {
		const vaultPath = tempRoot;

		await writeBrainAide(
			makeBrainAideContent({ connector: "obsidian", rootPath: vaultPath }),
		);
		// No .mcp.json written.

		const result = await buildBrainState(tempRoot);

		expect(result.status).toBe("no-mcp-entry");
		if (result.status === "no-mcp-entry") {
			expect(result.rootPath).toBe(vaultPath);
			expect(result.connector).toBe("obsidian");
		}
		expect(result).not.toHaveProperty("backend");
	});
});

// ---------------------------------------------------------------------------
// 4h. no-mcp-entry — .mcp.json exists but contains broken JSON.
// ---------------------------------------------------------------------------

describe("buildBrainState — no-mcp-entry: .mcp.json malformed (4h)", () => {
	it("returns no-mcp-entry when .mcp.json exists but cannot be parsed as JSON", async () => {
		const vaultPath = tempRoot;

		await writeBrainAide(
			makeBrainAideContent({ connector: "obsidian", rootPath: vaultPath }),
		);
		await writeMcpJson("{ not valid json }");

		const result = await buildBrainState(tempRoot);

		expect(result.status).toBe("no-mcp-entry");
		expect(result).not.toHaveProperty("backend");
	});
});

// ---------------------------------------------------------------------------
// 4i. no-mcp-entry — .mcp.json present but no mcpServers.brain key.
// ---------------------------------------------------------------------------

describe("buildBrainState — no-mcp-entry: no brain key (4i)", () => {
	it("returns no-mcp-entry when .mcp.json has mcpServers but no brain key", async () => {
		const vaultPath = tempRoot;

		await writeBrainAide(
			makeBrainAideContent({ connector: "obsidian", rootPath: vaultPath }),
		);
		// .mcp.json has mcpServers.aide but NOT mcpServers.brain.
		await writeMcpJson(
			JSON.stringify({
				mcpServers: {
					aide: { command: "npx", args: ["aidemd-mcp"] },
				},
			}),
		);

		const result = await buildBrainState(tempRoot);

		expect(result.status).toBe("no-mcp-entry");
		expect(result).not.toHaveProperty("backend");
	});
});

// ---------------------------------------------------------------------------
// 4j. mcp-drift — command differs.
// ---------------------------------------------------------------------------

describe("buildBrainState — mcp-drift: command mismatch (4j)", () => {
	it("returns mcp-drift when .mcp.json brain entry command differs from brain.aide", async () => {
		const vaultPath = tempRoot;

		// brain.aide declares command: npx
		await writeBrainAide(
			makeBrainAideContent({
				connector: "obsidian",
				rootPath: vaultPath,
				command: "npx",
			}),
		);
		// .mcp.json has command: node — deliberate mismatch
		await writeMcpJson(
			makeMcpJson({ command: "node", args: ["-y", "obsidian-mcp", vaultPath] }),
		);

		const result = await buildBrainState(tempRoot);

		expect(result.status).toBe("mcp-drift");
		expect(result).not.toHaveProperty("backend");
	});
});

// ---------------------------------------------------------------------------
// 4k. mcp-drift — args differ (various shapes via it.each).
// ---------------------------------------------------------------------------

describe("buildBrainState — mcp-drift: args mismatch (4k)", () => {
	/** Each entry: [description, brainAideArgs, mcpJsonArgs] */
	it.each([
		[
			"extra arg appended to .mcp.json entry",
			["-y", "obsidian-mcp", "${rootPath}"],
			// Actual rootPath will be injected dynamically below — use a sentinel
			// here; the test overwrites it per run.
			["-y", "obsidian-mcp", "__VAULT__", "--extra-flag"],
		],
		[
			"rootPath arg changed to old vault (user edited brain.aide, forgot sync)",
			["-y", "obsidian-mcp", "${rootPath}"],
			["-y", "obsidian-mcp", "/old/vault/path"],
		],
		[
			"arg count shorter than expected",
			["-y", "obsidian-mcp", "${rootPath}"],
			["-y", "obsidian-mcp"],
		],
		[
			"arg value differs at middle position",
			["-y", "obsidian-mcp", "${rootPath}"],
			["-y", "different-package", "__VAULT__"],
		],
	])(
		"returns mcp-drift when %s",
		async (_desc, brainAideArgs, rawMcpArgs) => {
			const vaultPath = tempRoot;

			await writeBrainAide(
				makeBrainAideContent({
					connector: "obsidian",
					rootPath: vaultPath,
					command: "npx",
					args: brainAideArgs,
				}),
			);

			// Replace the __VAULT__ sentinel with the real vault path so the test
			// fixture is realistic (actual absolute path, just a different one).
			const mcpArgs = rawMcpArgs.map((a: string) =>
				a === "__VAULT__" ? vaultPath : a,
			);

			await writeMcpJson(makeMcpJson({ command: "npx", args: mcpArgs }));

			const result = await buildBrainState(tempRoot);

			expect(result.status).toBe("mcp-drift");
			expect(result).not.toHaveProperty("backend");
		},
	);
});

// ---------------------------------------------------------------------------
// 4l. No registry dispatch — enforced by import absence (see file-level comment).
// The invariant is structural: this file never imports from @/service/brainBackends.
// No runtime assertion is possible for an absent import — the invariant lives in
// the comment above and in the spec's undesired outcomes. A future contributor
// adding a brainBackends import here violates the spec.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// 4m. No connector dispatch — detection is connector-agnostic.
// Two ok cases with different connector labels; result shape identical except connector.
// ---------------------------------------------------------------------------

describe("buildBrainState — no connector dispatch (4m)", () => {
	it.each([
		["obsidian", "-y", "obsidian-mcp"],
		["notion", "-y", "notion-mcp"],
	])(
		"returns ok with connector=%s without varying detection logic",
		async (connector, flag, packageName) => {
			const vaultPath = tempRoot;
			const args = [flag, packageName, "${rootPath}"];

			await writeBrainAide(
				makeBrainAideContent({
					connector,
					rootPath: vaultPath,
					command: "npx",
					args,
				}),
			);
			// .mcp.json must match the interpolated form: ${rootPath} → vaultPath
			await writeMcpJson(
				makeMcpJson({
					command: "npx",
					args: [flag, packageName, vaultPath],
				}),
			);

			const result = await buildBrainState(tempRoot);

			expect(result.status).toBe("ok");
			if (result.status === "ok") {
				expect(result.connector).toBe(connector);
				expect(result.rootPath).toBe(vaultPath);
			}
			expect(result).not.toHaveProperty("backend");
		},
	);

	it("obsidian and notion ok results share identical shape structure, differing only in connector", async () => {
		// This test makes the connector-agnostic contract explicit: run both
		// connectors and assert the shapes are structurally identical minus connector.
		async function runWith(connector: string, packageName: string) {
			// Unique subdirectory so both runs use valid but independent vaults.
			const vaultDir = await mkdtemp(join(tmpdir(), `vault-${connector}-`));
			try {
				const aideDir = join(vaultDir, ".aide");
				await mkdir(aideDir, { recursive: true });

				const args = ["-y", packageName, "${rootPath}"];
				const content = makeBrainAideContent({
					connector,
					rootPath: vaultDir,
					command: "npx",
					args,
				});
				await writeFile(join(aideDir, "brain.aide"), content, "utf-8");
				await writeFile(
					join(vaultDir, ".mcp.json"),
					makeMcpJson({ command: "npx", args: ["-y", packageName, vaultDir] }),
					"utf-8",
				);

				mockDetectFramework.mockResolvedValue(FIXED_FRAMEWORK_CONFIG);
				const result = await buildBrainState(vaultDir);
				return result;
			} finally {
				await rm(vaultDir, { recursive: true, force: true });
			}
		}

		const obsidianResult = await runWith("obsidian", "obsidian-mcp");
		const notionResult = await runWith("notion", "notion-mcp");

		// Both must be ok.
		expect(obsidianResult.status).toBe("ok");
		expect(notionResult.status).toBe("ok");

		// Shape keys must be identical (status, rootPath, connector, hints).
		expect(Object.keys(obsidianResult).sort()).toEqual(
			Object.keys(notionResult).sort(),
		);

		// connector values differ; everything else structurally equivalent.
		if (obsidianResult.status === "ok" && notionResult.status === "ok") {
			expect(obsidianResult.connector).toBe("obsidian");
			expect(notionResult.connector).toBe("notion");
			// Neither carries a backend field.
			expect(obsidianResult).not.toHaveProperty("backend");
			expect(notionResult).not.toHaveProperty("backend");
		}
	});
});

// ---------------------------------------------------------------------------
// Bonus: hints pass through to every returned state.
// ---------------------------------------------------------------------------

describe("buildBrainState — hints propagation", () => {
	it("carries hints on no-brain-aide state when resolveBrainHints returns candidates", async () => {
		const hint = { source: "env" as const, path: "/candidate/vault" };
		mockResolveBrainHints.mockResolvedValue([hint]);
		// No brain.aide → no-brain-aide branch.

		const result = await buildBrainState(tempRoot);

		expect(result.status).toBe("no-brain-aide");
		expect(result.hints).toEqual([hint]);
	});
});
