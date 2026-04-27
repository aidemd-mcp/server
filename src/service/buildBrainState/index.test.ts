/**
 * Tests for buildBrainState — the four-state brain precondition detector.
 *
 * INVARIANT (3n): This file MUST NOT import from `@/service/brainBackends`.
 * The detector never calls resolveBackend or any registry function; importing
 * that module here would re-introduce the anti-pattern the spec explicitly
 * retired. If you find yourself reaching for brainBackends in a test, stop —
 * the test design is wrong.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

// Mock only the two helpers whose output the detector consumes structurally.
// parseBrainAide and readFile operate on real temp files — no fs mocking.
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

/**
 * Minimal valid brain.aide content against the new two-field schema.
 * Emits ONLY `name` and `mcpServerConfig.{command, args}` — no `connector`,
 * no `rootPath`, no `entryFile`, no `tools`. Body includes `## Prose` heading
 * plus a prose line so parseBrainAide returns `kind: "ok"`.
 */
function makeBrainAideContent({
	name = "obsidian",
	command = "npx",
	args = ["@bitbonsai/mcpvault", "<vault-path>"],
}: {
	name?: string;
	command?: string;
	args?: string[];
}): string {
	const argsYaml = args.map((a) => `    - "${a}"`).join("\n");
	return [
		"---",
		`name: ${name}`,
		"mcpServerConfig:",
		`  command: ${command}`,
		"  args:",
		argsYaml,
		"---",
		"",
		"<!-- aide-prose-start -->",
		"This is the hand-written prose the agent receives verbatim.",
		"<!-- aide-prose-end -->",
		"",
		"<!-- aide-playbook-start -->",
		"The coding-playbook hub lives here.",
		"<!-- aide-playbook-end -->",
		"",
		"<!-- aide-study-playbook-start -->",
		"The study-playbook hub lives here.",
		"<!-- aide-study-playbook-end -->",
		"",
		"<!-- aide-research-start -->",
		"The research hub lives here.",
		"<!-- aide-research-end -->",
	].join("\n");
}

/** Build a .mcp.json whose mcpServers.brain entry carries the given command/args. */
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
	// Ensure .aide/config/ exists so brain.aide can be written into it.
	await mkdir(join(tempRoot, ".aide", "config"), { recursive: true });
});

afterEach(async () => {
	await rm(tempRoot, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// Helper: write brain.aide into tempRoot at the canonical path
// parseBrainAide reads from .aide/config/brain.aide
// ---------------------------------------------------------------------------

async function writeBrainAide(content: string): Promise<void> {
	await writeFile(join(tempRoot, ".aide", "config", "brain.aide"), content, "utf-8");
}

async function writeMcpJson(content: string): Promise<void> {
	await writeFile(join(tempRoot, ".mcp.json"), content, "utf-8");
}

// ---------------------------------------------------------------------------
// 3a. ok — brain.aide parses, .mcp.json matches exactly.
// ---------------------------------------------------------------------------

describe("buildBrainState — ok state (3a)", () => {
	it("returns ok with name and hints when brain.aide is valid and .mcp.json matches exactly", async () => {
		await writeBrainAide(
			makeBrainAideContent({
				name: "obsidian",
				command: "npx",
				args: ["@bitbonsai/mcpvault", "/x/vault"],
			}),
		);
		await writeMcpJson(
			makeMcpJson({ command: "npx", args: ["@bitbonsai/mcpvault", "/x/vault"] }),
		);

		const result = await buildBrainState(tempRoot);

		expect(result.status).toBe("ok");
		if (result.status === "ok") {
			expect(result.name).toBe("obsidian");
			expect(result.hints).toEqual([]);
		}
		// Retired fields must not exist anywhere on the returned shape.
		expect(result).not.toHaveProperty("rootPath");
		expect(result).not.toHaveProperty("connector");
		expect(result).not.toHaveProperty("entryFile");
		expect(result).not.toHaveProperty("tools");
		expect(result).not.toHaveProperty("backend");
	});
});

// ---------------------------------------------------------------------------
// 3b. no-brain-aide — brain.aide file is missing entirely.
// ---------------------------------------------------------------------------

describe("buildBrainState — no-brain-aide: file missing (3b)", () => {
	it("returns no-brain-aide when .aide/config/brain.aide does not exist", async () => {
		// No brain.aide written — tempRoot/.aide/config/ exists but brain.aide is absent.
		const result = await buildBrainState(tempRoot);

		expect(result.status).toBe("no-brain-aide");
		expect(result).not.toHaveProperty("name");
		expect(result).not.toHaveProperty("rootPath");
		expect(result).not.toHaveProperty("connector");
		expect(result).not.toHaveProperty("backend");
	});
});

// ---------------------------------------------------------------------------
// 3c. no-brain-aide — brain.aide exists but frontmatter is malformed YAML.
// ---------------------------------------------------------------------------

describe("buildBrainState — no-brain-aide: frontmatter malformed (3c)", () => {
	it("returns no-brain-aide when brain.aide contains broken YAML frontmatter", async () => {
		await writeBrainAide(
			[
				"---",
				"name: obsidian",
				"mcpServerConfig: [this is: broken: yaml: {",
				"---",
				"",
				"## Prose",
				"content",
			].join("\n"),
		);

		const result = await buildBrainState(tempRoot);

		expect(result.status).toBe("no-brain-aide");
		expect(result).not.toHaveProperty("name");
		expect(result).not.toHaveProperty("rootPath");
		expect(result).not.toHaveProperty("connector");
		expect(result).not.toHaveProperty("backend");
	});
});

// ---------------------------------------------------------------------------
// 3d. no-brain-aide — brain.aide has valid frontmatter but no ## Prose heading.
// ---------------------------------------------------------------------------

describe("buildBrainState — no-brain-aide: body malformed (3d)", () => {
	it("returns no-brain-aide when brain.aide has valid frontmatter but missing aide marker sections", async () => {
		// Valid two-field frontmatter but the body has no aide marker pairs.
		await writeBrainAide(
			[
				"---",
				"name: obsidian",
				"mcpServerConfig:",
				"  command: npx",
				"  args:",
				'    - "@bitbonsai/mcpvault"',
				'    - "/x/vault"',
				"---",
				"",
				"This body has no aide marker sections, only free text.",
			].join("\n"),
		);

		const result = await buildBrainState(tempRoot);

		expect(result.status).toBe("no-brain-aide");
		expect(result).not.toHaveProperty("name");
		expect(result).not.toHaveProperty("rootPath");
		expect(result).not.toHaveProperty("connector");
		expect(result).not.toHaveProperty("backend");
	});
});

// ---------------------------------------------------------------------------
// 3e. no-brain-aide — parser rejects deprecated field alongside valid fields.
// Anchors that ALL malformed-frontmatter sub-cases collapse to no-brain-aide.
// ---------------------------------------------------------------------------

describe("buildBrainState — no-brain-aide: parser rejects deprecated field (3e)", () => {
	it("returns no-brain-aide when brain.aide frontmatter carries a deprecated field (rootPath)", async () => {
		// Deprecated field rootPath present alongside valid name/mcpServerConfig.
		// parseBrainAide rejects this with malformed-frontmatter; detector collapses to no-brain-aide.
		await writeBrainAide(
			[
				"---",
				"name: obsidian",
				"rootPath: D:/notes/something",
				"mcpServerConfig:",
				"  command: npx",
				"  args:",
				'    - "@bitbonsai/mcpvault"',
				'    - "/x/vault"',
				"---",
				"",
				"## Prose",
				"",
				"This is the prose body.",
			].join("\n"),
		);

		const result = await buildBrainState(tempRoot);

		expect(result.status).toBe("no-brain-aide");
		expect(result).not.toHaveProperty("name");
		expect(result).not.toHaveProperty("rootPath");
		expect(result).not.toHaveProperty("connector");
		expect(result).not.toHaveProperty("backend");
	});
});

// ---------------------------------------------------------------------------
// 3f. no-mcp-entry — brain.aide valid, no .mcp.json written.
// ---------------------------------------------------------------------------

describe("buildBrainState — no-mcp-entry: .mcp.json missing (3f)", () => {
	it("returns no-mcp-entry with name when .mcp.json does not exist", async () => {
		await writeBrainAide(
			makeBrainAideContent({
				name: "obsidian",
				command: "npx",
				args: ["@bitbonsai/mcpvault", "/x/vault"],
			}),
		);
		// No .mcp.json written.

		const result = await buildBrainState(tempRoot);

		expect(result.status).toBe("no-mcp-entry");
		if (result.status === "no-mcp-entry") {
			expect(result.name).toBe("obsidian");
			expect(result.hints).toEqual([]);
		}
		expect(result).not.toHaveProperty("rootPath");
		expect(result).not.toHaveProperty("connector");
		expect(result).not.toHaveProperty("backend");
	});
});

// ---------------------------------------------------------------------------
// 3g. no-mcp-entry — .mcp.json exists but contains broken JSON.
// ---------------------------------------------------------------------------

describe("buildBrainState — no-mcp-entry: .mcp.json malformed (3g)", () => {
	it("returns no-mcp-entry when .mcp.json exists but cannot be parsed as JSON", async () => {
		await writeBrainAide(
			makeBrainAideContent({
				name: "obsidian",
				command: "npx",
				args: ["@bitbonsai/mcpvault", "/x/vault"],
			}),
		);
		await writeMcpJson("{ not valid json }");

		const result = await buildBrainState(tempRoot);

		expect(result.status).toBe("no-mcp-entry");
		if (result.status === "no-mcp-entry") {
			expect(result.name).toBe("obsidian");
		}
		expect(result).not.toHaveProperty("rootPath");
		expect(result).not.toHaveProperty("connector");
		expect(result).not.toHaveProperty("backend");
	});
});

// ---------------------------------------------------------------------------
// 3h. no-mcp-entry — .mcp.json has mcpServers.aide but no mcpServers.brain.
// ---------------------------------------------------------------------------

describe("buildBrainState — no-mcp-entry: no brain key (3h)", () => {
	it("returns no-mcp-entry when .mcp.json has mcpServers but no brain key", async () => {
		await writeBrainAide(
			makeBrainAideContent({
				name: "obsidian",
				command: "npx",
				args: ["@bitbonsai/mcpvault", "/x/vault"],
			}),
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
		if (result.status === "no-mcp-entry") {
			expect(result.name).toBe("obsidian");
		}
		expect(result).not.toHaveProperty("backend");
	});
});

// ---------------------------------------------------------------------------
// 3i. mcp-drift — command mismatch.
// ---------------------------------------------------------------------------

describe("buildBrainState — mcp-drift: command mismatch (3i)", () => {
	it("returns mcp-drift when .mcp.json brain entry command differs from brain.aide", async () => {
		// brain.aide declares command: npx
		await writeBrainAide(
			makeBrainAideContent({
				name: "obsidian",
				command: "npx",
				args: ["@bitbonsai/mcpvault", "/x/vault"],
			}),
		);
		// .mcp.json has command: node — deliberate mismatch
		await writeMcpJson(
			makeMcpJson({ command: "node", args: ["@bitbonsai/mcpvault", "/x/vault"] }),
		);

		const result = await buildBrainState(tempRoot);

		expect(result.status).toBe("mcp-drift");
		if (result.status === "mcp-drift") {
			expect(result.name).toBe("obsidian");
		}
		expect(result).not.toHaveProperty("backend");
	});
});

// ---------------------------------------------------------------------------
// 3j. mcp-drift — args mismatch via it.each.
// All inline-path args (no ${rootPath} placeholders — that field is gone).
// ---------------------------------------------------------------------------

describe("buildBrainState — mcp-drift: args mismatch (3j)", () => {
	/** Each entry: [description, brainAideArgs, mcpJsonArgs] */
	it.each([
		[
			"extra arg appended to .mcp.json entry",
			["@bitbonsai/mcpvault", "/x/vault"],
			["@bitbonsai/mcpvault", "/x/vault", "--extra-flag"],
		],
		[
			"brain root path differs (user retargeted brain.aide, forgot sync)",
			["@bitbonsai/mcpvault", "/x/new-vault"],
			["@bitbonsai/mcpvault", "/x/old-vault"],
		],
		[
			"arg count shorter than expected",
			["@bitbonsai/mcpvault", "/x/vault"],
			["@bitbonsai/mcpvault"],
		],
		[
			"package name differs at middle position",
			["@bitbonsai/mcpvault", "/x/vault"],
			["different-package", "/x/vault"],
		],
	])(
		"returns mcp-drift when %s",
		async (_desc, brainAideArgs, mcpJsonArgs) => {
			await writeBrainAide(
				makeBrainAideContent({
					name: "obsidian",
					command: "npx",
					args: brainAideArgs,
				}),
			);
			await writeMcpJson(makeMcpJson({ command: "npx", args: mcpJsonArgs }));

			const result = await buildBrainState(tempRoot);

			expect(result.status).toBe("mcp-drift");
		},
	);
});

// ---------------------------------------------------------------------------
// 3k. No name dispatch — two ok cases with different name values, identical shape.
// ---------------------------------------------------------------------------

describe("buildBrainState — no name dispatch (3k)", () => {
	it.each([
		["obsidian", "npx", ["@bitbonsai/mcpvault", "/x/vault"]],
		["notion", "npx", ["@notionhq/mcp", "/x/notion-vault"]],
	])(
		"returns ok regardless of name=%s",
		async (name, command, args) => {
			await writeBrainAide(makeBrainAideContent({ name, command, args }));
			await writeMcpJson(makeMcpJson({ command, args }));

			const result = await buildBrainState(tempRoot);

			expect(result.status).toBe("ok");
			if (result.status === "ok") {
				expect(result.name).toBe(name);
			}
		},
	);

	it("obsidian and notion ok results share identical object key sets, differing only in name value", async () => {
		async function runWith(name: string, args: string[]) {
			const root = await mkdtemp(join(tmpdir(), `bbs-name-dispatch-${name}-`));
			try {
				await mkdir(join(root, ".aide", "config"), { recursive: true });
				const content = makeBrainAideContent({ name, command: "npx", args });
				await writeFile(join(root, ".aide", "config", "brain.aide"), content, "utf-8");
				await writeFile(
					join(root, ".mcp.json"),
					makeMcpJson({ command: "npx", args }),
					"utf-8",
				);
				mockDetectFramework.mockResolvedValue(FIXED_FRAMEWORK_CONFIG);
				mockResolveBrainHints.mockResolvedValue([]);
				return await buildBrainState(root);
			} finally {
				await rm(root, { recursive: true, force: true });
			}
		}

		const obsidianResult = await runWith("obsidian", ["@bitbonsai/mcpvault", "/x/vault"]);
		const notionResult = await runWith("notion", ["@notionhq/mcp", "/x/notion-vault"]);

		// Both must be ok.
		expect(obsidianResult.status).toBe("ok");
		expect(notionResult.status).toBe("ok");

		// Object key sets must be identical — same fields present on both shapes.
		expect(Object.keys(obsidianResult).sort()).toEqual(Object.keys(notionResult).sort());

		// Only the name value differs; everything else is structurally equivalent.
		if (obsidianResult.status === "ok" && notionResult.status === "ok") {
			expect(obsidianResult.name).toBe("obsidian");
			expect(notionResult.name).toBe("notion");
			// Neither carries retired fields.
			expect(obsidianResult).not.toHaveProperty("backend");
			expect(notionResult).not.toHaveProperty("backend");
			expect(obsidianResult).not.toHaveProperty("connector");
			expect(notionResult).not.toHaveProperty("connector");
		}
	});
});

// ---------------------------------------------------------------------------
// 3l. Drift comparison is structural, not byte-equal.
// Same command/args semantically, .mcp.json formatted with different whitespace.
// ---------------------------------------------------------------------------

describe("buildBrainState — structural equality, not byte-equality (3l)", () => {
	it("returns ok when brain.aide and .mcp.json agree semantically despite different JSON formatting", async () => {
		await writeBrainAide(
			makeBrainAideContent({
				name: "obsidian",
				command: "npx",
				args: ["@bitbonsai/mcpvault", "/x/vault"],
			}),
		);
		// Write .mcp.json with 4-space indent and extra trailing newline — different
		// serialization than JSON.stringify(_, null, 2) but semantically identical.
		const differentlyFormatted =
			JSON.stringify({ mcpServers: { brain: { command: "npx", args: ["@bitbonsai/mcpvault", "/x/vault"] } } }, null, 4) + "\n";
		await writeMcpJson(differentlyFormatted);

		const result = await buildBrainState(tempRoot);

		expect(result.status).toBe("ok");
	});
});

// ---------------------------------------------------------------------------
// 3m. Hints propagate to every state.
// ---------------------------------------------------------------------------

describe("buildBrainState — hints propagate to every state (3m)", () => {
	const HINT = [{ source: "env" as const, path: "/candidate/vault" }];

	beforeEach(() => {
		mockResolveBrainHints.mockResolvedValue(HINT);
	});

	it("carries hints on no-brain-aide state", async () => {
		// No brain.aide → no-brain-aide branch.
		const result = await buildBrainState(tempRoot);
		expect(result.status).toBe("no-brain-aide");
		expect(result.hints).toEqual(HINT);
	});

	it("carries hints on no-mcp-entry state", async () => {
		await writeBrainAide(
			makeBrainAideContent({ name: "obsidian", args: ["@bitbonsai/mcpvault", "/x/vault"] }),
		);
		// No .mcp.json → no-mcp-entry branch.
		const result = await buildBrainState(tempRoot);
		expect(result.status).toBe("no-mcp-entry");
		expect(result.hints).toEqual(HINT);
	});

	it("carries hints on mcp-drift state", async () => {
		await writeBrainAide(
			makeBrainAideContent({ name: "obsidian", args: ["@bitbonsai/mcpvault", "/x/vault"] }),
		);
		await writeMcpJson(
			makeMcpJson({ command: "node", args: ["@bitbonsai/mcpvault", "/x/vault"] }),
		);
		const result = await buildBrainState(tempRoot);
		expect(result.status).toBe("mcp-drift");
		expect(result.hints).toEqual(HINT);
	});

	it("carries hints on ok state", async () => {
		await writeBrainAide(
			makeBrainAideContent({ name: "obsidian", args: ["@bitbonsai/mcpvault", "/x/vault"] }),
		);
		await writeMcpJson(
			makeMcpJson({ command: "npx", args: ["@bitbonsai/mcpvault", "/x/vault"] }),
		);
		const result = await buildBrainState(tempRoot);
		expect(result.status).toBe("ok");
		expect(result.hints).toEqual(HINT);
	});
});

// ---------------------------------------------------------------------------
// 3n. No registry import — by absence (see file-level comment).
// The invariant is structural: this file never imports from @/service/brainBackends.
// No runtime assertion is possible for an absent import — the invariant lives in
// the comment at the top of this file and in the spec's undesired outcomes.
// A future contributor adding a brainBackends import here violates the spec.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// 3o. Detector never throws — every state produces a structured value.
// ---------------------------------------------------------------------------

describe("buildBrainState — detector never throws (3o)", () => {
	it("resolves to no-brain-aide (missing) without rejecting", async () => {
		await expect(buildBrainState(tempRoot)).resolves.toMatchObject({ status: "no-brain-aide" });
	});

	it("resolves to no-brain-aide (malformed frontmatter) without rejecting", async () => {
		await writeBrainAide("---\nbroken: [yaml: {\n---\n\n## Prose\ncontent");
		await expect(buildBrainState(tempRoot)).resolves.toMatchObject({ status: "no-brain-aide" });
	});

	it("resolves to no-brain-aide (body malformed) without rejecting", async () => {
		await writeBrainAide(
			["---", "name: obsidian", "mcpServerConfig:", "  command: npx", "  args:", '    - "@bitbonsai/mcpvault"', "---", "", "No aide marker sections here."].join("\n"),
		);
		await expect(buildBrainState(tempRoot)).resolves.toMatchObject({ status: "no-brain-aide" });
	});

	it("resolves to no-mcp-entry (missing .mcp.json) without rejecting", async () => {
		await writeBrainAide(
			makeBrainAideContent({ name: "obsidian", args: ["@bitbonsai/mcpvault", "/x/vault"] }),
		);
		await expect(buildBrainState(tempRoot)).resolves.toMatchObject({ status: "no-mcp-entry" });
	});

	it("resolves to no-mcp-entry (malformed .mcp.json) without rejecting", async () => {
		await writeBrainAide(
			makeBrainAideContent({ name: "obsidian", args: ["@bitbonsai/mcpvault", "/x/vault"] }),
		);
		await writeMcpJson("{ not valid json }");
		await expect(buildBrainState(tempRoot)).resolves.toMatchObject({ status: "no-mcp-entry" });
	});

	it("resolves to mcp-drift without rejecting", async () => {
		await writeBrainAide(
			makeBrainAideContent({ name: "obsidian", args: ["@bitbonsai/mcpvault", "/x/vault"] }),
		);
		await writeMcpJson(makeMcpJson({ command: "node", args: ["@bitbonsai/mcpvault", "/x/vault"] }));
		await expect(buildBrainState(tempRoot)).resolves.toMatchObject({ status: "mcp-drift" });
	});

	it("resolves to ok without rejecting", async () => {
		await writeBrainAide(
			makeBrainAideContent({ name: "obsidian", args: ["@bitbonsai/mcpvault", "/x/vault"] }),
		);
		await writeMcpJson(makeMcpJson({ command: "npx", args: ["@bitbonsai/mcpvault", "/x/vault"] }));
		await expect(buildBrainState(tempRoot)).resolves.toMatchObject({ status: "ok" });
	});
});
