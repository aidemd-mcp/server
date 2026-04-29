import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, mkdir, writeFile, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { runSync } from "./index.js";

// ---------------------------------------------------------------------------
// Shared fixture: a hand-crafted brain.aide using the two-field schema.
// Using a literal fixture (not obsidianBrainAideTemplate) keeps tests
// platform-independent — the template emits platform-specific command/args.
// The brain root path used here is a stable test sentinel embedded inline in args.
// YAML args scalars use single quotes to avoid backslash-escape on Windows paths.
// ---------------------------------------------------------------------------

const TEST_BRAIN_PATH = "/test/vault";

const VALID_BRAIN_AIDE = `---
name: obsidian
mcpServerConfig:
  command: npx
  args:
    - '@bitbonsai/mcpvault'
    - '${TEST_BRAIN_PATH}'
---

<!-- aide-orientation-start -->
Your brain is an Obsidian vault. Use mcp__brain__read_note to open files.
<!-- aide-orientation-end -->

<!-- aide-config-start -->
<!-- aide-config-end -->

<!-- aide-playbook-index-start -->
The coding-playbook section lives here.
<!-- aide-playbook-index-end -->

<!-- aide-study-playbook-start -->
The study-playbook hub lives here.
<!-- aide-study-playbook-end -->

<!-- aide-update-playbook-start -->
<!-- aide-update-playbook-end -->

<!-- aide-research-index-start -->
The research section lives here.
<!-- aide-research-index-end -->
`;

// The expected entry derived from VALID_BRAIN_AIDE — args are byte-for-byte
// from mcpServerConfig; no interpolation occurs on the default scaffold.
const EXPECTED_BRAIN_ENTRY = {
	command: "npx",
	args: ["@bitbonsai/mcpvault", TEST_BRAIN_PATH],
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function writeBrainAide(root: string, content: string): Promise<void> {
	await mkdir(join(root, ".aide", "config"), { recursive: true });
	await writeFile(join(root, ".aide", "config", "brain.aide"), content, "utf-8");
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

		expect(lines.join("\n")).toContain("Read .aide/config/brain.aide");
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
name: obsidian
mcpServerConfig:
  command: npx
  args:
    - '@bitbonsai/mcpvault'
    - [unclosed bracket
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
// 3g. Malformed body — hub sections absent (migration-failure path)
// ---------------------------------------------------------------------------

describe("3g — malformed body (hub sections absent)", () => {
	it("exits 1, stderr contains parser reason naming missing markers, .mcp.json unchanged", async () => {
		// Fixture: valid frontmatter but no recognized section markers at all.
		// Old retired markers (aide-prose-start, aide-playbook-start, aide-research-start)
		// are treated as plain bytes by the parser, so the error names all six missing
		// new marker pairs.
		const noSectionsBody = `---
name: obsidian
mcpServerConfig:
  command: npx
  args:
    - '@bitbonsai/mcpvault'
    - '${TEST_BRAIN_PATH}'
---

Your brain is an Obsidian vault. Use mcp__brain__read_note to open files.
`;
		await writeBrainAide(tempDir, noSectionsBody);
		await writeMcpJson(tempDir, { mcpServers: {} });
		const before = await readFile(join(tempDir, ".mcp.json"), "utf-8");

		const { errLines, write, writeErr } = makeCapture();
		const code = await runSync(tempDir, write, writeErr);

		expect(code).toBe(1);
		// The parser's reason must name the missing marker pairs (new vocabulary).
		const stderr = errLines.join("\n");
		expect(stderr).toContain("<!-- aide-orientation-start -->");
		expect(stderr).toContain("<!-- aide-playbook-index-start -->");
		expect(stderr).not.toContain("## Orientation");

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
// 3j. Default-scaffold args pass through verbatim (interpolateArgs is a no-op)
// ---------------------------------------------------------------------------

describe("3j — default-scaffold no-op interpolation", () => {
	it("default-scaffold args pass through verbatim (interpolateArgs is a no-op)", async () => {
		// Setup: canonical two-field shape with no ${...} placeholders anywhere in args.
		// Single-quoted YAML scalars avoid Windows path backslash-escape issues.
		const noPlaceholderBrainAide = `---
name: obsidian
mcpServerConfig:
  command: npx
  args:
    - '@bitbonsai/mcpvault'
    - '/literal/inline/path'
---

<!-- aide-orientation-start -->
Prose body.
<!-- aide-orientation-end -->

<!-- aide-config-start -->
<!-- aide-config-end -->

<!-- aide-playbook-index-start -->
The coding-playbook section lives here.
<!-- aide-playbook-index-end -->

<!-- aide-study-playbook-start -->
The study-playbook hub lives here.
<!-- aide-study-playbook-end -->

<!-- aide-update-playbook-start -->
<!-- aide-update-playbook-end -->

<!-- aide-research-index-start -->
The research section lives here.
<!-- aide-research-index-end -->
`;
		await writeBrainAide(tempDir, noPlaceholderBrainAide);

		const { write, writeErr } = makeCapture();
		const code = await runSync(tempDir, write, writeErr);

		expect(code).toBe(0);

		const written = JSON.parse(await readFile(join(tempDir, ".mcp.json"), "utf-8"));
		// Args must be byte-for-byte from mcpServerConfig — no substitution occurred
		// because no placeholder was present. Locks in outcomes.desired[1].
		expect(written.mcpServers.brain.args).toEqual([
			"@bitbonsai/mcpvault",
			"/literal/inline/path",
		]);
	});

	it("advanced-user `${name}` placeholder resolves at sync time", async () => {
		// Setup: brain.aide with ${name} placeholder in args. Single-quoted YAML
		// scalars preserve the literal $ character on all platforms.
		const withNamePlaceholder = `---
name: my-vault
mcpServerConfig:
  command: npx
  args:
    - 'some-launcher'
    - '--profile'
    - '\${name}'
---

<!-- aide-orientation-start -->
Prose body.
<!-- aide-orientation-end -->

<!-- aide-config-start -->
<!-- aide-config-end -->

<!-- aide-playbook-index-start -->
The coding-playbook section lives here.
<!-- aide-playbook-index-end -->

<!-- aide-study-playbook-start -->
The study-playbook hub lives here.
<!-- aide-study-playbook-end -->

<!-- aide-update-playbook-start -->
<!-- aide-update-playbook-end -->

<!-- aide-research-index-start -->
The research section lives here.
<!-- aide-research-index-end -->
`;
		await writeBrainAide(tempDir, withNamePlaceholder);

		const { write, writeErr } = makeCapture();
		const code = await runSync(tempDir, write, writeErr);

		expect(code).toBe(0);

		const written = JSON.parse(await readFile(join(tempDir, ".mcp.json"), "utf-8"));
		// The literal name value must be substituted into the placeholder slot.
		expect(written.mcpServers.brain.args).toEqual([
			"some-launcher",
			"--profile",
			"my-vault",
		]);
	});
});

// ---------------------------------------------------------------------------
// 3k. No prose interpolation
// ---------------------------------------------------------------------------

describe("3k — no prose interpolation", () => {
	it("brain.aide is byte-unchanged after sync; only .mcp.json is mutated", async () => {
		const proseWithPlaceholder = `---
name: obsidian
mcpServerConfig:
  command: npx
  args:
    - '@bitbonsai/mcpvault'
    - '${TEST_BRAIN_PATH}'
---

<!-- aide-orientation-start -->
This prose body contains a literal \${rootPath} placeholder and also \${entryFile}.
These should pass through verbatim — sync only interpolates mcpServerConfig.args.
<!-- aide-orientation-end -->

<!-- aide-config-start -->
<!-- aide-config-end -->

<!-- aide-playbook-index-start -->
The coding-playbook section lives here.
<!-- aide-playbook-index-end -->

<!-- aide-study-playbook-start -->
The study-playbook hub lives here.
<!-- aide-study-playbook-end -->

<!-- aide-update-playbook-start -->
<!-- aide-update-playbook-end -->

<!-- aide-research-index-start -->
The research section lives here.
<!-- aide-research-index-end -->
`;
		await writeBrainAide(tempDir, proseWithPlaceholder);

		const brainAidePath = join(tempDir, ".aide", "config", "brain.aide");
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

		// .mcp.json was created and has the correct entry — args pass through verbatim.
		const mcp = JSON.parse(await readFile(join(tempDir, ".mcp.json"), "utf-8"));
		expect(mcp.mcpServers.brain).toEqual(EXPECTED_BRAIN_ENTRY);
	});
});
