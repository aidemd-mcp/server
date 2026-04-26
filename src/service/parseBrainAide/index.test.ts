import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import parseBrainAide, { parseBrainAideFromString, interpolateArgs } from "./index.js";
import type { BrainAideConfig } from "@/types/index.js";

// ---------------------------------------------------------------------------
// 5a. Shared fixture: the canonical brain.aide from the spec's good example
// ---------------------------------------------------------------------------

const CANONICAL_BRAIN_AIDE = `---
name: obsidian
mcpServerConfig:
  command: npx
  args:
    - "@bitbonsai/mcpvault"
    - "D:/notes/my-vault"
---

## Prose

Your brain is an Obsidian vault. Use \`mcp__brain__read_note\` to open
files by their vault-relative path. Use \`mcp__brain__search_notes\`
for keyword queries across every note in the vault. The vault's
entry file is \`CLAUDE.md\` at the vault root — read that first; it
carries wikilinks (\`[[note-name]]\`) you follow to deepen context.
`;

const CANONICAL_CONFIG: BrainAideConfig = {
	name: "obsidian",
	mcpServerConfig: {
		command: "npx",
		args: ["@bitbonsai/mcpvault", "D:/notes/my-vault"],
	},
};

// ---------------------------------------------------------------------------
// 5b. Helpers
// ---------------------------------------------------------------------------

async function writeBrainAide(root: string, content: string): Promise<void> {
	await mkdir(join(root, ".aide", "config"), { recursive: true });
	await writeFile(join(root, ".aide", "config", "brain.aide"), content, "utf-8");
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

let tempDir: string;

beforeEach(async () => {
	tempDir = await mkdtemp(join(tmpdir(), "aide-parse-brain-aide-"));
});

afterEach(async () => {
	await rm(tempDir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// 5c. 3a. Happy path
// ---------------------------------------------------------------------------

describe("3a — happy path", () => {
	it("returns ok with two-field config and prose starting with first sentence", async () => {
		await writeBrainAide(tempDir, CANONICAL_BRAIN_AIDE);

		const result = await parseBrainAide(tempDir);

		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return;

		expect(result.config.name).toBe("obsidian");
		expect(result.config.mcpServerConfig.command).toBe("npx");
		expect(result.config.mcpServerConfig.args).toEqual(["@bitbonsai/mcpvault", "D:/notes/my-vault"]);
		// Prose starts with the first sentence from the spec's good example.
		// The blank line between the ## Prose heading and the body text is
		// preserved — the implementation strips only the single newline immediately
		// after the heading, not subsequent blank lines.
		expect(result.prose).toMatch(/Your brain is an Obsidian vault\./);
	});
});

// ---------------------------------------------------------------------------
// 5d. 3b. Missing file
// ---------------------------------------------------------------------------

describe("3b — missing file", () => {
	it("returns missing when no .aide/config/brain.aide exists — never throws", async () => {
		// tempDir exists but no .aide/config/brain.aide inside it
		const result = await parseBrainAide(tempDir);

		expect(result.kind).toBe("missing");
	});
});

// ---------------------------------------------------------------------------
// 5d. 3c. Malformed YAML
// ---------------------------------------------------------------------------

describe("3c — malformed YAML frontmatter", () => {
	it("returns malformed-frontmatter with a non-empty reason for invalid YAML", async () => {
		const badYaml = `---
mcpServerConfig:
  args: [unclosed bracket
---

## Prose

Some prose.
`;
		await writeBrainAide(tempDir, badYaml);

		const result = await parseBrainAide(tempDir);

		expect(result.kind).toBe("malformed-frontmatter");
		if (result.kind !== "malformed-frontmatter") return;
		expect(result.reason.length).toBeGreaterThan(0);
	});
});

// ---------------------------------------------------------------------------
// 5e. 3d. Missing required field (parameterized)
// ---------------------------------------------------------------------------

describe("3d — missing required field", () => {
	function makeContentMissing(field: string): string {
		let frontmatterLines: string[];

		if (field === "name") {
			// Include mcpServerConfig but omit name
			frontmatterLines = [
				"mcpServerConfig:",
				"  command: npx",
				'  args:',
				'    - "@bitbonsai/mcpvault"',
				'    - "D:/notes/my-vault"',
			];
		} else if (field === "mcpServerConfig.command") {
			// Include mcpServerConfig but omit the command sub-key
			frontmatterLines = [
				"name: obsidian",
				"mcpServerConfig:",
				'  args:',
				'    - "@bitbonsai/mcpvault"',
				'    - "D:/notes/my-vault"',
			];
		} else if (field === "mcpServerConfig.args") {
			// Include mcpServerConfig but omit the args sub-key
			frontmatterLines = [
				"name: obsidian",
				"mcpServerConfig:",
				"  command: npx",
			];
		} else {
			// Fallback: full valid frontmatter (should not be reached by test cases)
			frontmatterLines = [
				"name: obsidian",
				"mcpServerConfig:",
				"  command: npx",
				'  args:',
				'    - "@bitbonsai/mcpvault"',
				'    - "D:/notes/my-vault"',
			];
		}

		return `---\n${frontmatterLines.join("\n")}\n---\n\n## Prose\n\nSome prose body.\n`;
	}

	it.each([
		"name",
		"mcpServerConfig.command",
		"mcpServerConfig.args",
	])("missing %s → malformed-frontmatter with reason mentioning the field", async (field) => {
		const content = makeContentMissing(field);
		await writeBrainAide(tempDir, content);

		const result = await parseBrainAide(tempDir);

		expect(result.kind).toBe("malformed-frontmatter");
		if (result.kind !== "malformed-frontmatter") return;
		// The reason string must name exactly which field is wrong
		expect(result.reason).toContain(field);
	});
});

// ---------------------------------------------------------------------------
// 5f. 3d'. Deprecated-field rejection (parameterized)
// ---------------------------------------------------------------------------

describe("3d' — deprecated field rejection", () => {
	// Each test case: [description, yaml-frontmatter-lines, expected-reason]
	// Every fixture includes valid required fields so the deprecated-field
	// check is the failing branch — proves rejection fires AFTER required-field
	// validation passes.
	const cases: Array<[description: string, extraLines: string[], expectedReason: string]> = [
		[
			"single deprecated field: connector",
			["connector: obsidian"],
			"deprecated fields: connector",
		],
		[
			"single deprecated field: rootPath",
			["rootPath: D:/notes/my-vault"],
			"deprecated fields: rootPath",
		],
		[
			"single deprecated field: entryFile",
			["entryFile: CLAUDE.md"],
			"deprecated fields: entryFile",
		],
		[
			"single deprecated field: tools",
			["tools:", "  read: mcp__brain__read_note", "  search: mcp__brain__search_notes"],
			"deprecated fields: tools",
		],
		[
			"multiple deprecated fields: rootPath + tools listed in deprecated-set order",
			["rootPath: D:/notes/my-vault", "tools:", "  read: mcp__brain__read_note", "  search: mcp__brain__search_notes"],
			"deprecated fields: rootPath, tools",
		],
		[
			"multiple deprecated fields: connector + entryFile listed in deprecated-set order",
			["connector: obsidian", "entryFile: CLAUDE.md"],
			"deprecated fields: connector, entryFile",
		],
		[
			"all four deprecated fields: reason lists all in set order",
			[
				"connector: obsidian",
				"rootPath: D:/notes/my-vault",
				"entryFile: CLAUDE.md",
				"tools:",
				"  read: mcp__brain__read_note",
				"  search: mcp__brain__search_notes",
			],
			"deprecated fields: connector, rootPath, entryFile, tools",
		],
	];

	it.each(cases)("%s", async (_description, extraLines, expectedReason) => {
		const requiredLines = [
			"name: obsidian",
			"mcpServerConfig:",
			"  command: npx",
			'  args:',
			'    - "@bitbonsai/mcpvault"',
			'    - "D:/notes/my-vault"',
		];
		const frontmatter = [...requiredLines, ...extraLines].join("\n");
		const content = `---\n${frontmatter}\n---\n\n## Prose\n\nSome prose body.\n`;

		await writeBrainAide(tempDir, content);

		const result = await parseBrainAide(tempDir);

		expect(result.kind).toBe("malformed-frontmatter");
		if (result.kind !== "malformed-frontmatter") return;
		expect(result.reason).toBe(expectedReason);
	});
});

// ---------------------------------------------------------------------------
// 5g. 3e. Missing prose body
// ---------------------------------------------------------------------------

describe("3e — missing prose body", () => {
	it("returns malformed-body when valid frontmatter has no ## Prose heading", async () => {
		const content = `---
name: obsidian
mcpServerConfig:
  command: npx
  args:
    - "@bitbonsai/mcpvault"
    - "D:/notes/my-vault"
---

This is the body but there is no Prose heading here.
`;
		await writeBrainAide(tempDir, content);

		const result = await parseBrainAide(tempDir);

		expect(result.kind).toBe("malformed-body");
		if (result.kind !== "malformed-body") return;
		expect(result.reason).toContain("## Prose");
	});
});

// ---------------------------------------------------------------------------
// 5g. 3f. Prose returned verbatim (no-substitution invariant)
// ---------------------------------------------------------------------------

describe("3f — prose returned verbatim", () => {
	it("prose body containing literal ${name} and ${rootPath} passes through byte-identical", async () => {
		// ${rootPath} is deprecated as a frontmatter field but a user might write it
		// in their prose to describe something else — it must pass through unchanged.
		const literalProseBody = `This is a prose body with a literal \${name} placeholder.

It also has **markdown** and a [link](https://example.com) and a wikilink [[note-name]].

The \${rootPath} value is also here for good measure.
`;
		const content = `---
name: obsidian
mcpServerConfig:
  command: npx
  args:
    - "@bitbonsai/mcpvault"
    - "D:/notes/my-vault"
---

## Prose

${literalProseBody}`;
		await writeBrainAide(tempDir, content);

		const result = await parseBrainAide(tempDir);

		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return;
		// The prose must contain the literal ${name} unchanged — no substitution
		expect(result.prose).toContain("${name}");
		// ${rootPath} in prose is not a deprecated frontmatter field — it is just prose text
		expect(result.prose).toContain("${rootPath}");
		expect(result.prose).toContain("**markdown**");
		expect(result.prose).toContain("[[note-name]]");
		// Full byte-identity check: the prose equals the literal body string
		// preceded by the blank line between the heading and the body
		// (implementation strips the single \n after ## Prose but preserves
		// any subsequent blank lines, so the blank separator line is part of prose).
		expect(result.prose).toBe("\n" + literalProseBody);
	});
});

// ---------------------------------------------------------------------------
// 5g. 3g. Name is metadata, not dispatched on
// ---------------------------------------------------------------------------

describe("3g — name is metadata, not dispatched on", () => {
	function makeContentWithName(name: string): string {
		return `---
name: ${name}
mcpServerConfig:
  command: npx
  args:
    - "@bitbonsai/mcpvault"
    - "D:/notes/my-vault"
---

## Prose

Prose body for ${name} brain.
`;
	}

	it("obsidian and notion names both parse identically — result.kind is ok for both", async () => {
		const obsidianDir = await mkdtemp(join(tmpdir(), "aide-name-obsidian-"));
		const notionDir = await mkdtemp(join(tmpdir(), "aide-name-notion-"));

		try {
			await writeBrainAide(obsidianDir, makeContentWithName("obsidian"));
			await writeBrainAide(notionDir, makeContentWithName("notion"));

			const obsidianResult = await parseBrainAide(obsidianDir);
			const notionResult = await parseBrainAide(notionDir);

			expect(obsidianResult.kind).toBe("ok");
			expect(notionResult.kind).toBe("ok");

			if (obsidianResult.kind !== "ok" || notionResult.kind !== "ok") return;

			// Both have the same shape — only name value and prose differ
			expect(obsidianResult.config.name).toBe("obsidian");
			expect(notionResult.config.name).toBe("notion");

			// mcpServerConfig is identical — name did not influence it
			expect(obsidianResult.config.mcpServerConfig).toEqual(notionResult.config.mcpServerConfig);

			// Both prose bodies pass through verbatim (no name-based rewriting).
			// The blank line between ## Prose and the body text is preserved in prose.
			expect(obsidianResult.prose).toBe("\nProse body for obsidian brain.\n");
			expect(notionResult.prose).toBe("\nProse body for notion brain.\n");
		} finally {
			await rm(obsidianDir, { recursive: true, force: true });
			await rm(notionDir, { recursive: true, force: true });
		}
	});
});

// ---------------------------------------------------------------------------
// 5h. 3h. interpolateArgs — canonical config is a no-op
// ---------------------------------------------------------------------------

describe("3h — interpolateArgs canonical config is a no-op", () => {
	it("canonical args have no placeholders — return is structurally equal to input args", () => {
		const result = interpolateArgs(CANONICAL_CONFIG);

		expect(result).toEqual(["@bitbonsai/mcpvault", "D:/notes/my-vault"]);
	});

	it("does not mutate the original config.mcpServerConfig.args", () => {
		const originalArgs = [...CANONICAL_CONFIG.mcpServerConfig.args];

		interpolateArgs(CANONICAL_CONFIG);

		expect(CANONICAL_CONFIG.mcpServerConfig.args).toEqual(originalArgs);
	});

	it("advanced-user case: ${name} in args is substituted with config.name", () => {
		const config: BrainAideConfig = {
			name: "my-vault",
			mcpServerConfig: {
				command: "some-launcher",
				args: ["some-launcher", "--profile", "${name}"],
			},
		};

		const result = interpolateArgs(config);

		expect(result).toEqual(["some-launcher", "--profile", "my-vault"]);
	});
});

// ---------------------------------------------------------------------------
// 5h. 3i. interpolateArgs is positional (string replacement, not arg replacement)
// ---------------------------------------------------------------------------

describe("3i — interpolateArgs is positional", () => {
	it("substitutes ${name} embedded within a larger string, not the whole arg", () => {
		const config: BrainAideConfig = {
			name: "my-brain",
			mcpServerConfig: {
				...CANONICAL_CONFIG.mcpServerConfig,
				args: ["prefix-${name}-suffix"],
			},
		};

		const result = interpolateArgs(config);

		expect(result).toEqual(["prefix-my-brain-suffix"]);
	});

	it("substitutes multiple occurrences of ${name} within a single arg", () => {
		const config: BrainAideConfig = {
			name: "my-brain",
			mcpServerConfig: {
				...CANONICAL_CONFIG.mcpServerConfig,
				args: ["${name}:${name}"],
			},
		};

		const result = interpolateArgs(config);

		expect(result).toEqual(["my-brain:my-brain"]);
	});
});

// ---------------------------------------------------------------------------
// 5h. 3j. interpolateArgs does not touch the prose body
// ---------------------------------------------------------------------------

describe("3j — interpolateArgs does not touch the prose body", () => {
	it("interpolateArgs takes only config — it has no path that receives prose", async () => {
		await writeBrainAide(tempDir, CANONICAL_BRAIN_AIDE);
		const parseResult = await parseBrainAide(tempDir);

		expect(parseResult.kind).toBe("ok");
		if (parseResult.kind !== "ok") return;

		const proseBeforeInterpolation = parseResult.prose;

		// interpolateArgs only accepts config — prose is structurally excluded from its signature
		const interpolated = interpolateArgs(parseResult.config);

		// Calling interpolateArgs did not affect the prose string in any way
		expect(parseResult.prose).toBe(proseBeforeInterpolation);
		// The interpolated result is the args array — no prose string in the return value
		expect(Array.isArray(interpolated)).toBe(true);
		expect(interpolated).not.toContain(proseBeforeInterpolation);
	});
});

// ---------------------------------------------------------------------------
// 5i. 3k. parseBrainAideFromString parses bytes identically to parseBrainAide
// ---------------------------------------------------------------------------

describe("3k — parseBrainAideFromString parses bytes identically to parseBrainAide from disk", () => {
	it("ok result — canonical bytes from disk and from string are deep-equal", async () => {
		await writeBrainAide(tempDir, CANONICAL_BRAIN_AIDE);

		const fromDisk = await parseBrainAide(tempDir);
		const fromString = parseBrainAideFromString(CANONICAL_BRAIN_AIDE);

		expect(fromDisk).toEqual(fromString);
		expect(fromDisk.kind).toBe("ok");
	});

	it("malformed-frontmatter — empty string returns malformed-frontmatter from string parser", () => {
		const result = parseBrainAideFromString("");

		expect(result.kind).toBe("malformed-frontmatter");
	});

	it("malformed-frontmatter — invalid YAML parses identically via both paths", async () => {
		const badYaml = `---
mcpServerConfig:
  args: [unclosed
---

## Prose

Prose.
`;
		await writeBrainAide(tempDir, badYaml);

		const fromDisk = await parseBrainAide(tempDir);
		const fromString = parseBrainAideFromString(badYaml);

		expect(fromDisk.kind).toBe("malformed-frontmatter");
		expect(fromString.kind).toBe("malformed-frontmatter");
		expect(fromDisk).toEqual(fromString);
	});

	it("malformed-body — missing ## Prose heading parses identically via both paths", async () => {
		const noProseContent = `---
name: obsidian
mcpServerConfig:
  command: npx
  args:
    - "@bitbonsai/mcpvault"
    - "D:/notes/my-vault"
---

Body with no Prose heading.
`;
		await writeBrainAide(tempDir, noProseContent);

		const fromDisk = await parseBrainAide(tempDir);
		const fromString = parseBrainAideFromString(noProseContent);

		expect(fromDisk.kind).toBe("malformed-body");
		expect(fromString.kind).toBe("malformed-body");
		expect(fromDisk).toEqual(fromString);
	});

	it("missing variant is only reachable via parseBrainAide (no file on disk)", async () => {
		// parseBrainAide with no file → missing
		const fromDisk = await parseBrainAide(tempDir);
		expect(fromDisk.kind).toBe("missing");

		// parseBrainAideFromString with empty input → malformed-frontmatter (missing is unreachable)
		const fromString = parseBrainAideFromString("");
		expect(fromString.kind).toBe("malformed-frontmatter");
	});
});
