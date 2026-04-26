import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import parseBrainAide, { parseBrainAideFromString, interpolateArgs } from "./index.js";
import type { BrainAideConfig } from "@/types/index.js";

// ---------------------------------------------------------------------------
// Shared fixture: the canonical Obsidian brain.aide from the spec's good example
// ---------------------------------------------------------------------------

const CANONICAL_BRAIN_AIDE = `---
connector: obsidian
rootPath: D:/notes/my-vault
entryFile: CLAUDE.md
mcpServerConfig:
  command: npx
  args:
    - "-y"
    - "obsidian-mcp"
    - "\${rootPath}"
tools:
  read: mcp__brain__read_note
  search: mcp__brain__search_notes
---

## Prose

Your brain is an Obsidian vault. Use \`mcp__brain__read_note\` to open
files by their vault-relative path. Use \`mcp__brain__search_notes\`
for keyword queries across every note in the vault. The vault's
entry file is \`CLAUDE.md\` at the vault root — read that first; it
carries wikilinks (\`[[note-name]]\`) you follow to deepen context.
`;

const CANONICAL_CONFIG: BrainAideConfig = {
	connector: "obsidian",
	rootPath: "D:/notes/my-vault",
	entryFile: "CLAUDE.md",
	mcpServerConfig: {
		command: "npx",
		args: ["-y", "obsidian-mcp", "${rootPath}"],
	},
	tools: {
		read: "mcp__brain__read_note",
		search: "mcp__brain__search_notes",
	},
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function writeBrainAide(root: string, content: string): Promise<void> {
	await mkdir(join(root, ".aide"), { recursive: true });
	await writeFile(join(root, ".aide", "brain.aide"), content, "utf-8");
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
// 3a. Happy path
// ---------------------------------------------------------------------------

describe("3a — happy path", () => {
	it("returns ok with all config fields correct and prose starting with first sentence", async () => {
		await writeBrainAide(tempDir, CANONICAL_BRAIN_AIDE);

		const result = await parseBrainAide(tempDir);

		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return;

		expect(result.config.connector).toBe("obsidian");
		expect(result.config.rootPath).toBe("D:/notes/my-vault");
		expect(result.config.entryFile).toBe("CLAUDE.md");
		expect(result.config.mcpServerConfig.command).toBe("npx");
		// args contain the literal placeholder, pre-interpolation
		expect(result.config.mcpServerConfig.args).toEqual(["-y", "obsidian-mcp", "${rootPath}"]);
		expect(result.config.tools.read).toBe("mcp__brain__read_note");
		expect(result.config.tools.search).toBe("mcp__brain__search_notes");
		// Prose starts with the first sentence from the spec's good example.
		// The blank line between the ## Prose heading and the body text is
		// preserved — the implementation strips only the single newline immediately
		// after the heading, not subsequent blank lines.
		expect(result.prose).toMatch(/Your brain is an Obsidian vault\./);
	});
});

// ---------------------------------------------------------------------------
// 3b. Missing file
// ---------------------------------------------------------------------------

describe("3b — missing file", () => {
	it("returns missing when no .aide/brain.aide exists — never throws", async () => {
		// tempDir exists but no .aide/brain.aide inside it
		const result = await parseBrainAide(tempDir);

		expect(result.kind).toBe("missing");
	});
});

// ---------------------------------------------------------------------------
// 3c. Malformed YAML
// ---------------------------------------------------------------------------

describe("3c — malformed YAML frontmatter", () => {
	it("returns malformed-frontmatter with a non-empty reason for invalid YAML", async () => {
		const badYaml = `---
connector: obsidian
rootPath: [unclosed bracket
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
// 3d. Missing required field (parameterized)
// ---------------------------------------------------------------------------

describe("3d — missing required field", () => {
	function makeContentMissing(field: string): string {
		// Build a valid canonical YAML block and then remove the specified field line.
		// For nested fields like mcpServerConfig.command and tools.read / tools.search,
		// we handle them explicitly below.
		const validFrontmatter: Record<string, string> = {
			connector: "obsidian",
			rootPath: "D:/notes/my-vault",
			entryFile: "CLAUDE.md",
		};

		let frontmatterLines: string[];

		if (field === "mcpServerConfig.command") {
			// Include mcpServerConfig but omit the command sub-key
			frontmatterLines = [
				`connector: ${validFrontmatter.connector}`,
				`rootPath: ${validFrontmatter.rootPath}`,
				`entryFile: ${validFrontmatter.entryFile}`,
				"mcpServerConfig:",
				'  args:',
				'    - "-y"',
				'    - "obsidian-mcp"',
				'    - "${rootPath}"',
				"tools:",
				"  read: mcp__brain__read_note",
				"  search: mcp__brain__search_notes",
			];
		} else if (field === "tools.read") {
			frontmatterLines = [
				`connector: ${validFrontmatter.connector}`,
				`rootPath: ${validFrontmatter.rootPath}`,
				`entryFile: ${validFrontmatter.entryFile}`,
				"mcpServerConfig:",
				"  command: npx",
				'  args:',
				'    - "-y"',
				'    - "obsidian-mcp"',
				'    - "${rootPath}"',
				"tools:",
				"  search: mcp__brain__search_notes",
			];
		} else if (field === "tools.search") {
			frontmatterLines = [
				`connector: ${validFrontmatter.connector}`,
				`rootPath: ${validFrontmatter.rootPath}`,
				`entryFile: ${validFrontmatter.entryFile}`,
				"mcpServerConfig:",
				"  command: npx",
				'  args:',
				'    - "-y"',
				'    - "obsidian-mcp"',
				'    - "${rootPath}"',
				"tools:",
				"  read: mcp__brain__read_note",
			];
		} else {
			// Top-level field: omit it from the frontmatter
			const remaining = Object.entries(validFrontmatter)
				.filter(([k]) => k !== field)
				.map(([k, v]) => `${k}: ${v}`);
			frontmatterLines = [
				...remaining,
				"mcpServerConfig:",
				"  command: npx",
				'  args:',
				'    - "-y"',
				'    - "obsidian-mcp"',
				'    - "${rootPath}"',
				"tools:",
				"  read: mcp__brain__read_note",
				"  search: mcp__brain__search_notes",
			];
		}

		return `---\n${frontmatterLines.join("\n")}\n---\n\n## Prose\n\nSome prose body.\n`;
	}

	it.each([
		"rootPath",
		"entryFile",
		"mcpServerConfig.command",
		"tools.read",
		"tools.search",
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
// 3e. Missing prose body
// ---------------------------------------------------------------------------

describe("3e — missing prose body", () => {
	it("returns malformed-body when valid frontmatter has no ## Prose heading", async () => {
		const content = `---
connector: obsidian
rootPath: D:/notes/my-vault
entryFile: CLAUDE.md
mcpServerConfig:
  command: npx
  args:
    - "-y"
    - "obsidian-mcp"
    - "\${rootPath}"
tools:
  read: mcp__brain__read_note
  search: mcp__brain__search_notes
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
// 3f. Prose returned verbatim (no-substitution invariant)
// ---------------------------------------------------------------------------

describe("3f — prose returned verbatim", () => {
	it("prose body containing literal ${rootPath} and other markdown passes through byte-identical", async () => {
		const literalProseBody = `This is a prose body with a literal \${rootPath} placeholder.

It also has **markdown** and a [link](https://example.com) and a wikilink [[note-name]].

The \${entryFile} value is also here for good measure.
`;
		const content = `---
connector: obsidian
rootPath: D:/notes/my-vault
entryFile: CLAUDE.md
mcpServerConfig:
  command: npx
  args:
    - "-y"
    - "obsidian-mcp"
    - "\${rootPath}"
tools:
  read: mcp__brain__read_note
  search: mcp__brain__search_notes
---

## Prose

${literalProseBody}`;
		await writeBrainAide(tempDir, content);

		const result = await parseBrainAide(tempDir);

		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return;
		// The prose must contain the literal ${rootPath} unchanged — no substitution
		expect(result.prose).toContain("${rootPath}");
		expect(result.prose).toContain("${entryFile}");
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
// 3g. Connector is metadata, not dispatched on
// ---------------------------------------------------------------------------

describe("3g — connector is metadata, not dispatched on", () => {
	function makeContentWithConnector(connector: string): string {
		return `---
connector: ${connector}
rootPath: D:/notes/my-vault
entryFile: CLAUDE.md
mcpServerConfig:
  command: npx
  args:
    - "-y"
    - "obsidian-mcp"
    - "\${rootPath}"
tools:
  read: mcp__brain__read_note
  search: mcp__brain__search_notes
---

## Prose

Prose body for ${connector} connector.
`;
	}

	it("obsidian and notion connectors both parse identically — result.kind is ok for both", async () => {
		const obsidianDir = await mkdtemp(join(tmpdir(), "aide-connector-obsidian-"));
		const notionDir = await mkdtemp(join(tmpdir(), "aide-connector-notion-"));

		try {
			await writeBrainAide(obsidianDir, makeContentWithConnector("obsidian"));
			await writeBrainAide(notionDir, makeContentWithConnector("notion"));

			const obsidianResult = await parseBrainAide(obsidianDir);
			const notionResult = await parseBrainAide(notionDir);

			expect(obsidianResult.kind).toBe("ok");
			expect(notionResult.kind).toBe("ok");

			if (obsidianResult.kind !== "ok" || notionResult.kind !== "ok") return;

			// Both have the same shape — only connector value and prose differ
			expect(obsidianResult.config.connector).toBe("obsidian");
			expect(notionResult.config.connector).toBe("notion");

			// All other fields are identical
			expect(obsidianResult.config.rootPath).toBe(notionResult.config.rootPath);
			expect(obsidianResult.config.entryFile).toBe(notionResult.config.entryFile);
			expect(obsidianResult.config.mcpServerConfig).toEqual(notionResult.config.mcpServerConfig);
			expect(obsidianResult.config.tools).toEqual(notionResult.config.tools);

			// Both prose bodies pass through verbatim (no connector-based rewriting).
			// The blank line between ## Prose and the body text is preserved in prose.
			expect(obsidianResult.prose).toBe("\nProse body for obsidian connector.\n");
			expect(notionResult.prose).toBe("\nProse body for notion connector.\n");
		} finally {
			await rm(obsidianDir, { recursive: true, force: true });
			await rm(notionDir, { recursive: true, force: true });
		}
	});
});

// ---------------------------------------------------------------------------
// 3h. interpolateArgs substitutes ${rootPath}
// ---------------------------------------------------------------------------

describe("3h — interpolateArgs substitutes ${rootPath}", () => {
	it("replaces ${rootPath} with the literal rootPath value from config", () => {
		const result = interpolateArgs(CANONICAL_CONFIG);

		expect(result).toEqual(["-y", "obsidian-mcp", "D:/notes/my-vault"]);
	});

	it("does not mutate the original config.mcpServerConfig.args", () => {
		const originalArgs = [...CANONICAL_CONFIG.mcpServerConfig.args];

		interpolateArgs(CANONICAL_CONFIG);

		expect(CANONICAL_CONFIG.mcpServerConfig.args).toEqual(originalArgs);
	});
});

// ---------------------------------------------------------------------------
// 3i. interpolateArgs is positional (string replacement, not arg replacement)
// ---------------------------------------------------------------------------

describe("3i — interpolateArgs is positional", () => {
	it("substitutes ${rootPath} embedded within a larger string, not the whole arg", () => {
		const config: BrainAideConfig = {
			...CANONICAL_CONFIG,
			rootPath: "D:/notes/my-vault",
			mcpServerConfig: {
				...CANONICAL_CONFIG.mcpServerConfig,
				args: ["some-prefix-${rootPath}-suffix"],
			},
		};

		const result = interpolateArgs(config);

		expect(result).toEqual(["some-prefix-D:/notes/my-vault-suffix"]);
	});

	it("substitutes multiple occurrences of ${rootPath} within a single arg", () => {
		const config: BrainAideConfig = {
			...CANONICAL_CONFIG,
			rootPath: "D:/notes/my-vault",
			mcpServerConfig: {
				...CANONICAL_CONFIG.mcpServerConfig,
				args: ["${rootPath}:${rootPath}"],
			},
		};

		const result = interpolateArgs(config);

		expect(result).toEqual(["D:/notes/my-vault:D:/notes/my-vault"]);
	});
});

// ---------------------------------------------------------------------------
// 3j. interpolateArgs does not touch the prose body
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
// 3k. parseBrainAideFromString parses bytes identically to parseBrainAide
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
rootPath: [unclosed
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
connector: obsidian
rootPath: D:/notes/my-vault
entryFile: CLAUDE.md
mcpServerConfig:
  command: npx
  args:
    - "-y"
    - "obsidian-mcp"
    - "\${rootPath}"
tools:
  read: mcp__brain__read_note
  search: mcp__brain__search_notes
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
