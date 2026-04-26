import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, mkdir, writeFile, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { runSync } from "./index.js";

// ---------------------------------------------------------------------------
// Shared fixture: a hand-crafted brain.aide with a known rootPath.
// Using a literal fixture (not obsidianBrainAideTemplate) keeps tests
// platform-independent — the template emits platform-specific command/args.
// The rootPath used here is a stable test sentinel.
// ---------------------------------------------------------------------------

const TEST_ROOT_PATH = "/test/vault";

const VALID_BRAIN_AIDE = `---
connector: obsidian
rootPath: ${TEST_ROOT_PATH}
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

Your brain is an Obsidian vault. Use mcp__brain__read_note to open files.
`;

// The expected interpolated entry derived from VALID_BRAIN_AIDE.
const EXPECTED_BRAIN_ENTRY = {
	command: "npx",
	args: ["-y", "obsidian-mcp", TEST_ROOT_PATH],
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function writeBrainAide(root: string, content: string): Promise<void> {
	await mkdir(join(root, ".aide"), { recursive: true });
	await writeFile(join(root, ".aide", "brain.aide"), content, "utf-8");
}

async function writeMcpJson(root: string, content: object): Promise<void> {
	await writeFile(join(root, ".mcp.json"), JSON.stringify(content, null, 2) + "\n", "utf-8");
}

/** Capture stdout and stderr lines from runSync. */
function makeCapture(): {
	lines: string[];
	errLines: string[];
	write: (line: string) => void;
	writeErr: (line: string) => void;
} {
	const lines: string[] = [];
	const errLines: string[] = [];
	return {
		lines,
		errLines,
		write: (line) => lines.push(line),
		writeErr: (line) => errLines.push(line),
	};
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

let tempDir: string;

beforeEach(async () => {
	tempDir = await mkdtemp(join(tmpdir(), "aide-sync-"));
});

afterEach(async () => {
	await rm(tempDir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// 3a. Happy path
// ---------------------------------------------------------------------------

describe("3a — happy path", () => {
	it("writes brain entry into .mcp.json, exits 0, output mentions writing", async () => {
		await writeBrainAide(tempDir, VALID_BRAIN_AIDE);
		await writeMcpJson(tempDir, { mcpServers: { aide: { command: "npx", args: ["-y", "aidemd-mcp"] } } });

		const { lines, errLines, write, writeErr } = makeCapture();
		const code = await runSync(tempDir, write, writeErr);

		expect(code).toBe(0);
		expect(errLines).toHaveLength(0);

		const written = JSON.parse(await readFile(join(tempDir, ".mcp.json"), "utf-8"));
		expect(written.mcpServers.brain).toEqual(EXPECTED_BRAIN_ENTRY);

		// Output must mention the write action.
		expect(lines.join("\n")).toContain("Wrote brain MCP entry into .mcp.json");
		expect(lines.join("\n")).toContain("Done.");
	});
});

// ---------------------------------------------------------------------------
// 3b. Idempotent re-run
// ---------------------------------------------------------------------------

describe("3b — idempotent re-run", () => {
	it("exits 0, does not mutate the file, output says 'already in sync'", async () => {
		await writeBrainAide(tempDir, VALID_BRAIN_AIDE);
		// Pre-write .mcp.json with the already-correct brain entry (and obsidian absent).
		await writeMcpJson(tempDir, { mcpServers: { brain: EXPECTED_BRAIN_ENTRY } });

		const before = await readFile(join(tempDir, ".mcp.json"), "utf-8");

		const { lines, errLines, write, writeErr } = makeCapture();
		const code = await runSync(tempDir, write, writeErr);

		expect(code).toBe(0);
		expect(errLines).toHaveLength(0);

		const after = await readFile(join(tempDir, ".mcp.json"), "utf-8");
		// Bytes must be unchanged.
		expect(after).toBe(before);

		expect(lines.join("\n")).toContain("already in sync");
	});
});

// ---------------------------------------------------------------------------
// 3c. Legacy obsidian migration
// ---------------------------------------------------------------------------

describe("3c — legacy obsidian migration", () => {
	it("removes obsidian key, writes brain, exits 0, output mentions migration", async () => {
		await writeBrainAide(tempDir, VALID_BRAIN_AIDE);
		await writeMcpJson(tempDir, {
			mcpServers: {
				obsidian: { command: "npx", args: ["-y", "obsidian-mcp", "/old/vault"] },
			},
		});

		const { lines, errLines, write, writeErr } = makeCapture();
		const code = await runSync(tempDir, write, writeErr);

		expect(code).toBe(0);
		expect(errLines).toHaveLength(0);

		const written = JSON.parse(await readFile(join(tempDir, ".mcp.json"), "utf-8"));
		expect(written.mcpServers.brain).toEqual(EXPECTED_BRAIN_ENTRY);
		expect(written.mcpServers.obsidian).toBeUndefined();

		expect(lines.join("\n")).toContain("obsidian");
		expect(lines.join("\n")).toContain("migrated to");
	});
});

// ---------------------------------------------------------------------------
// 3d. Preserve other keys
// ---------------------------------------------------------------------------

describe("3d — preserve other keys", () => {
	it("leaves aide and custom-mcp entries structurally identical after sync", async () => {
		await writeBrainAide(tempDir, VALID_BRAIN_AIDE);

		const aideEntry = { command: "npx", args: ["-y", "aidemd-mcp"] };
		const customEntry = { command: "node", args: ["custom-server.js"] };

		await writeMcpJson(tempDir, {
			mcpServers: {
				aide: aideEntry,
				"custom-mcp": customEntry,
			},
		});

		const { write, writeErr } = makeCapture();
		const code = await runSync(tempDir, write, writeErr);

		expect(code).toBe(0);

		const written = JSON.parse(await readFile(join(tempDir, ".mcp.json"), "utf-8"));
		expect(written.mcpServers.aide).toEqual(aideEntry);
		expect(written.mcpServers["custom-mcp"]).toEqual(customEntry);
		expect(written.mcpServers.brain).toEqual(EXPECTED_BRAIN_ENTRY);
	});
});

// ---------------------------------------------------------------------------
// 3e. Missing brain.aide
// ---------------------------------------------------------------------------

describe("3e — missing brain.aide", () => {
	it("exits 1, stderr mentions aidemd-mcp init, .mcp.json unchanged (or absent)", async () => {
		// No brain.aide — tempDir has no .aide/ directory at all.
		await writeMcpJson(tempDir, { mcpServers: {} });
		const before = await readFile(join(tempDir, ".mcp.json"), "utf-8");

		const { errLines, write, writeErr } = makeCapture();
		const code = await runSync(tempDir, write, writeErr);

		expect(code).toBe(1);
		expect(errLines.join("\n")).toContain("aidemd-mcp init");

		const after = await readFile(join(tempDir, ".mcp.json"), "utf-8");
		expect(after).toBe(before);
	});

	it("exits 1 when .mcp.json is absent too — does not create it", async () => {
		// No brain.aide AND no .mcp.json.
		const { errLines, write, writeErr } = makeCapture();
		const code = await runSync(tempDir, write, writeErr);

		expect(code).toBe(1);
		expect(errLines.join("\n")).toContain("aidemd-mcp init");

		// .mcp.json must not have been created.
		await expect(readFile(join(tempDir, ".mcp.json"), "utf-8")).rejects.toThrow();
	});
});

// ---------------------------------------------------------------------------
// 3f. Malformed brain.aide frontmatter
// ---------------------------------------------------------------------------

describe("3f — malformed brain.aide frontmatter", () => {
	it("exits 1, stderr says 'Fix the YAML and re-run sync', .mcp.json unchanged", async () => {
		const badFrontmatter = `---
connector: obsidian
rootPath: [unclosed bracket
---

## Prose

Some prose.
`;
		await writeBrainAide(tempDir, badFrontmatter);
		await writeMcpJson(tempDir, { mcpServers: {} });
		const before = await readFile(join(tempDir, ".mcp.json"), "utf-8");

		const { errLines, write, writeErr } = makeCapture();
		const code = await runSync(tempDir, write, writeErr);

		expect(code).toBe(1);
		expect(errLines.join("\n")).toContain("Fix the YAML and re-run sync");

		const after = await readFile(join(tempDir, ".mcp.json"), "utf-8");
		expect(after).toBe(before);
	});
});

// ---------------------------------------------------------------------------
// 3g. Missing prose body
// ---------------------------------------------------------------------------

describe("3g — missing prose body", () => {
	it("exits 1, stderr mentions '## Prose', .mcp.json unchanged", async () => {
		const noProseBody = `---
connector: obsidian
rootPath: ${TEST_ROOT_PATH}
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

This body has no Prose heading at all.
`;
		await writeBrainAide(tempDir, noProseBody);
		await writeMcpJson(tempDir, { mcpServers: {} });
		const before = await readFile(join(tempDir, ".mcp.json"), "utf-8");

		const { errLines, write, writeErr } = makeCapture();
		const code = await runSync(tempDir, write, writeErr);

		expect(code).toBe(1);
		expect(errLines.join("\n")).toContain("## Prose");

		const after = await readFile(join(tempDir, ".mcp.json"), "utf-8");
		expect(after).toBe(before);
	});
});

// ---------------------------------------------------------------------------
// 3h. Malformed .mcp.json
// ---------------------------------------------------------------------------

describe("3h — malformed .mcp.json", () => {
	it("exits 1, stderr names 'Fix the syntax error', .mcp.json is byte-unchanged", async () => {
		await writeBrainAide(tempDir, VALID_BRAIN_AIDE);
		const invalidJson = "{ not valid json {{{{";
		await writeFile(join(tempDir, ".mcp.json"), invalidJson, "utf-8");
		const before = await readFile(join(tempDir, ".mcp.json"), "utf-8");

		const { errLines, write, writeErr } = makeCapture();
		const code = await runSync(tempDir, write, writeErr);

		expect(code).toBe(1);
		expect(errLines.join("\n")).toContain("Fix the syntax error");

		const after = await readFile(join(tempDir, ".mcp.json"), "utf-8");
		expect(after).toBe(before);
	});
});

// ---------------------------------------------------------------------------
// 3i. Cold start (no .mcp.json)
// ---------------------------------------------------------------------------

describe("3i — cold start (no .mcp.json)", () => {
	it("creates .mcp.json with only the brain entry, exits 0, output reports write", async () => {
		await writeBrainAide(tempDir, VALID_BRAIN_AIDE);
		// No .mcp.json exists.

		const { lines, errLines, write, writeErr } = makeCapture();
		const code = await runSync(tempDir, write, writeErr);

		expect(code).toBe(0);
		expect(errLines).toHaveLength(0);

		const written = JSON.parse(await readFile(join(tempDir, ".mcp.json"), "utf-8"));
		expect(written.mcpServers.brain).toEqual(EXPECTED_BRAIN_ENTRY);
		// Only the brain key should be present (cold start — no pre-existing keys).
		expect(Object.keys(written.mcpServers)).toEqual(["brain"]);

		expect(lines.join("\n")).toContain("Wrote brain MCP entry into .mcp.json");
	});
});

// ---------------------------------------------------------------------------
// 3j. Args interpolation
// ---------------------------------------------------------------------------

describe("3j — args interpolation", () => {
	it("substitutes the literal rootPath value into ${rootPath} position in args", async () => {
		const customRootPath = "/custom/brain/vault";
		const customBrainAide = `---
connector: obsidian
rootPath: ${customRootPath}
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

Prose body.
`;
		await writeBrainAide(tempDir, customBrainAide);

		const { write, writeErr } = makeCapture();
		const code = await runSync(tempDir, write, writeErr);

		expect(code).toBe(0);

		const written = JSON.parse(await readFile(join(tempDir, ".mcp.json"), "utf-8"));
		// The literal rootPath value must appear in the args array, not the placeholder.
		expect(written.mcpServers.brain.args).toContain(customRootPath);
		expect(written.mcpServers.brain.args).not.toContain("${rootPath}");
	});
});

// ---------------------------------------------------------------------------
// 3k. No prose interpolation
// ---------------------------------------------------------------------------

describe("3k — no prose interpolation", () => {
	it("brain.aide is byte-unchanged after sync; only .mcp.json is mutated", async () => {
		const proseWithPlaceholder = `---
connector: obsidian
rootPath: ${TEST_ROOT_PATH}
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

This prose body contains a literal \${rootPath} placeholder and also \${entryFile}.
These should pass through verbatim — sync only interpolates mcpServerConfig.args.
`;
		await writeBrainAide(tempDir, proseWithPlaceholder);

		const brainAidePath = join(tempDir, ".aide", "brain.aide");
		const brainBefore = await readFile(brainAidePath, "utf-8");

		const { write, writeErr } = makeCapture();
		const code = await runSync(tempDir, write, writeErr);

		expect(code).toBe(0);

		// brain.aide must be byte-identical after sync.
		const brainAfter = await readFile(brainAidePath, "utf-8");
		expect(brainAfter).toBe(brainBefore);

		// The prose placeholders must not have been substituted in the file.
		expect(brainAfter).toContain("${rootPath}");
		expect(brainAfter).toContain("${entryFile}");

		// .mcp.json was created and has the interpolated entry.
		const mcp = JSON.parse(await readFile(join(tempDir, ".mcp.json"), "utf-8"));
		expect(mcp.mcpServers.brain.args).toContain(TEST_ROOT_PATH);
	});
});
