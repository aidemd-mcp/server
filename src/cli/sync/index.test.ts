import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, mkdir, writeFile, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { runSync } from "./index.js";
import brainContract from "@/service/brainContract/index.js";
import toMarkerPair from "@/service/brainContract/toMarkerPair/index.js";
import type { BrainSectionMarker } from "@/types/index.js";

// ---------------------------------------------------------------------------
// Shared fixture: a brain.aide factory built from the published brainContract
// and toMarkerPair, so no test restates a marker name or marker bytes.
// YAML args scalars use single quotes to avoid backslash-escape on Windows paths.
// ---------------------------------------------------------------------------

const TEST_BRAIN_PATH = "/test/vault";

type BrainAideOptions = {
	name?: string;
	/** Raw YAML list lines for `mcpServerConfig.args`, each already indented and newline-terminated. */
	argsYaml?: string;
	/** Markers whose whole pair is left out of the body. */
	omit?: BrainSectionMarker[];
	/** Body text of the orientation section. */
	orientationBody?: string;
};

function makeBrainAide({
	name = "obsidian",
	argsYaml = `    - '@bitbonsai/mcpvault'
    - '${TEST_BRAIN_PATH}'
`,
	omit = [],
	orientationBody = "Your brain is an Obsidian vault. Use mcp__brain__read_note to open files.",
}: BrainAideOptions = {}): string {
	const body = brainContract
		.filter(({ marker }) => !omit.includes(marker))
		.map(({ marker }) => {
			const { open, close } = toMarkerPair(marker);
			const text = marker === "orientation" ? orientationBody : `Body for ${marker}.`;
			return `${open}
${text}
${close}`;
		})
		.join("\n\n");
	return `---
name: ${name}
mcpServerConfig:
  command: npx
  args:
${argsYaml}---

${body}
`;
}

const VALID_BRAIN_AIDE = makeBrainAide();

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
		// Pre-write .mcp.json with the already-correct brain entry.
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

describe("3e2 — unreadable brain.aide", () => {
	it("exits 1, stderr names the read error and never says brain.aide was not found, .mcp.json unchanged", async () => {
		// A directory at the config path: the entry exists but readFile fails with EISDIR.
		await mkdir(join(tempDir, ".aide", "config", "brain.aide"), { recursive: true });
		await writeMcpJson(tempDir, { mcpServers: {} });
		const before = await readFile(join(tempDir, ".mcp.json"), "utf-8");

		const { errLines, write, writeErr } = makeCapture();
		const code = await runSync(tempDir, write, writeErr);

		expect(code).toBe(1);
		const stderr = errLines.join("\n");
		expect(stderr).toContain("cannot read .aide/config/brain.aide");
		expect(stderr).toContain("EISDIR");
		expect(stderr).not.toContain("No `.aide/config/brain.aide` found");

		const after = await readFile(join(tempDir, ".mcp.json"), "utf-8");
		expect(after).toBe(before);
	});
});

describe("3e — missing brain.aide", () => {
	it("exits 1, stderr names the launcher-neutral init commands (no @latest), .mcp.json unchanged", async () => {
		// No brain.aide — tempDir has no .aide/ directory at all.
		await writeMcpJson(tempDir, { mcpServers: {} });
		const before = await readFile(join(tempDir, ".mcp.json"), "utf-8");

		const { errLines, write, writeErr } = makeCapture();
		const code = await runSync(tempDir, write, writeErr);

		expect(code).toBe(1);
		const stderr = errLines.join("\n");
		expect(stderr).toContain("aidemd-mcp init");
		expect(stderr).toContain("npx -y @aidemd-mcp/server@<version> init");
		expect(stderr).not.toContain("@latest");

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
		// A body with no marker pairs at all is the missing-sections refusal: every
		// contract section is named, and the user is routed to /aide:brain config.
		const stderr = errLines.join("\n");
		for (const { marker } of brainContract) expect(stderr).toContain(marker);
		expect(stderr).toContain("/aide:brain config");
		expect(stderr).not.toContain("## Orientation");

		const after = await readFile(join(tempDir, ".mcp.json"), "utf-8");
		expect(after).toBe(before);
	});
});

// ---------------------------------------------------------------------------
// 3g2. Missing required sections
// ---------------------------------------------------------------------------

describe("3g2 — missing required sections", () => {
	it("exits 1, stderr names every missing section and /aide:brain config, .mcp.json is neither read nor written", async () => {
		await writeBrainAide(tempDir, makeBrainAide({ omit: ["kanban-board", "kanban-index"] }));

		const { errLines, write, writeErr } = makeCapture();
		const code = await runSync(tempDir, write, writeErr);

		expect(code).toBe(1);
		expect(errLines).toHaveLength(1);
		expect(errLines[0]).toContain("kanban-board");
		expect(errLines[0]).toContain("kanban-index");
		expect(errLines[0]).toContain("/aide:brain config");

		// Absent before, absent after: the refusal never creates .mcp.json.
		await expect(readFile(join(tempDir, ".mcp.json"), "utf-8")).rejects.toThrow();
	});

	it("leaves an existing .mcp.json byte-identical", async () => {
		await writeBrainAide(tempDir, makeBrainAide({ omit: ["kanban-board", "kanban-index"] }));
		await writeMcpJson(tempDir, { mcpServers: { aide: { command: "npx", args: ["-y", "aidemd-mcp"] } } });
		const before = await readFile(join(tempDir, ".mcp.json"), "utf-8");

		const { write, writeErr } = makeCapture();
		const code = await runSync(tempDir, write, writeErr);

		expect(code).toBe(1);
		expect(await readFile(join(tempDir, ".mcp.json"), "utf-8")).toBe(before);
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
		const noPlaceholderBrainAide = makeBrainAide({
			argsYaml: "    - '@bitbonsai/mcpvault'\n    - '/literal/inline/path'\n",
		});
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
		const withNamePlaceholder = makeBrainAide({
			name: "my-vault",
			argsYaml: "    - 'some-launcher'\n    - '--profile'\n    - '${name}'\n",
		});
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
// 3l. Null-bearing args refusal
// ---------------------------------------------------------------------------

describe("3l — null-bearing args refusal", () => {
	function makeNullArgsBrainAide(argsYaml: string): string {
		return makeBrainAide({ argsYaml });
	}

	it("single null at args[3] exits 1 and stderr names the index", async () => {
		// args[0..2] are valid strings; args[3] is YAML null (bare `-` on its own line).
		const content = makeNullArgsBrainAide(
			"    - '-y'\n    - '@bitbonsai/mcpvault'\n    - '--rootDir'\n    -\n",
		);
		await writeBrainAide(tempDir, content);

		const { errLines, write, writeErr } = makeCapture();
		const code = await runSync(tempDir, write, writeErr);

		expect(code).toBe(1);
		expect(errLines.join("\n")).toContain("args[3] is null");
		expect(errLines.join("\n")).toContain("/aide:brain config");

		// .mcp.json was NOT created (no pre-write; file must not exist post-call).
		await expect(readFile(join(tempDir, ".mcp.json"), "utf-8")).rejects.toThrow();
	});

	it("multiple nulls at args[2] and args[4] are all named in stderr on one line", async () => {
		// args[0..1] valid, args[2] null, args[3] valid, args[4] null.
		const content = makeNullArgsBrainAide(
			"    - '-y'\n    - '@bitbonsai/mcpvault'\n    -\n    - '--rootDir'\n    -\n",
		);
		await writeBrainAide(tempDir, content);

		const { errLines, write, writeErr } = makeCapture();
		const code = await runSync(tempDir, write, writeErr);

		expect(code).toBe(1);
		// Both null indexes must appear in the same error line.
		expect(errLines).toHaveLength(1);
		expect(errLines[0]).toContain("args[2] is null");
		expect(errLines[0]).toContain("args[4] is null");
	});

	it("null-refusal does not touch existing .mcp.json", async () => {
		// Pre-write a brain.aide with one null in args AND a pre-existing .mcp.json
		// containing arbitrary mcpServers entries plus a prior brain entry.
		const content = makeNullArgsBrainAide(
			"    - '-y'\n    - '@bitbonsai/mcpvault'\n    - '--rootDir'\n    -\n",
		);
		await writeBrainAide(tempDir, content);
		await writeMcpJson(tempDir, {
			mcpServers: {
				aide: { command: "npx", args: ["-y", "aidemd-mcp"] },
				brain: { command: "npx", args: ["-y", "@bitbonsai/mcpvault", "--rootDir", "/old/path"] },
			},
		});

		const before = await readFile(join(tempDir, ".mcp.json"), "utf-8");

		const { write, writeErr } = makeCapture();
		const code = await runSync(tempDir, write, writeErr);

		expect(code).toBe(1);

		// Every byte of .mcp.json must be identical — including any prior brain entry.
		const after = await readFile(join(tempDir, ".mcp.json"), "utf-8");
		expect(after).toBe(before);
	});

	it("null-refusal does not coerce, drop, or substitute — brain.aide is byte-identical after refusal", async () => {
		// Pre-write brain.aide with one null at args[3]. After runSync, open
		// brain.aide and assert it is byte-identical to the pre-write state.
		// Sync must not have mutated .aide/config/brain.aide on the null-refusal path.
		const content = makeNullArgsBrainAide(
			"    - '-y'\n    - '@bitbonsai/mcpvault'\n    - '--rootDir'\n    -\n",
		);
		await writeBrainAide(tempDir, content);

		const brainAidePath = join(tempDir, ".aide", "config", "brain.aide");
		const brainBefore = await readFile(brainAidePath, "utf-8");

		const { write, writeErr } = makeCapture();
		const code = await runSync(tempDir, write, writeErr);

		expect(code).toBe(1);

		// brain.aide must be byte-identical after the refusal — sync never writes to .aide/config/.
		const brainAfter = await readFile(brainAidePath, "utf-8");
		expect(brainAfter).toBe(brainBefore);
	});
});

// ---------------------------------------------------------------------------
// 3k. No prose interpolation
// ---------------------------------------------------------------------------

describe("3k — no prose interpolation", () => {
	it("brain.aide is byte-unchanged after sync; only .mcp.json is mutated", async () => {
		const proseWithPlaceholder = makeBrainAide({
			orientationBody:
				"This prose body contains a literal ${rootPath} placeholder and also ${entryFile}.\nThese should pass through verbatim — sync only interpolates mcpServerConfig.args.",
		});
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
