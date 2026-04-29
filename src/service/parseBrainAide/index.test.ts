import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import parseBrainAide, { parseBrainAideFromString, interpolateArgs } from "./index.js";
import type { BrainAideConfig } from "@/types/index.js";

// ---------------------------------------------------------------------------
// 3a. Shared fixture: the canonical brain.aide with all six required sections.
//
// The fixture mirrors the spec's "Good examples" block. It exercises:
//   - All six required marker pairs in fixed order (orientation, config,
//     playbookIndex, studyPlaybook, updatePlaybook, researchIndex).
//   - A note-to-self ABOVE the first opener (between frontmatter and
//     <!-- aide-orientation-start -->) so bytes-outside-pairs silent-ignore is
//     observed end-to-end on the happy path.
//   - Non-trivial multi-paragraph content inside each section, including
//     markdown features the parser must NOT interpret: literal `#` H1 headings,
//     `##` and `###` headings, and literal `${name}`-shaped placeholders.
//     These prove the marker walker matches only the twelve exact byte sequences
//     and treats every other byte as section content.
//
// Vocabulary: storage-agnostic framing throughout — "external knowledge store",
// "brain-root-relative path", "brain's entry file is `CLAUDE.md` at the brain root".
// ---------------------------------------------------------------------------

const CANONICAL_BRAIN_AIDE = `---
name: my-brain
mcpServerConfig:
  command: npx
  args:
    - "@example/mcp-launcher"
    - "D:/brains/my-brain"
---

A note-to-self above the first opener — silently ignored by the
parser; the user can keep scratch text here without warning.

<!-- aide-orientation-start -->
Your brain is an external knowledge store reached through MCP tools.
Use the read-note tool to open files by their brain-root-relative
path. Use the search-notes tool for keyword queries across the
brain. The brain's entry file is \`CLAUDE.md\` at the brain root — read
that first; it lists the inline references your task may need.

Entry-point artifacts:
- \`coding-playbook/coding-playbook.md\` — root hub for coding conventions
- \`coding-playbook/study-playbook.md\` — how to navigate the playbook
- \`coding-playbook/update-playbook.md\` — how to maintain the playbook
- \`research/research.md\` — entry point for domain research
<!-- aide-orientation-end -->

<!-- aide-config-start -->
This brain is wired through an MCP server that exposes read and search
tools. The MCP server is configured in \`mcpServerConfig\` above with the
command and arguments needed to launch it. The wiring connects your
agent harness to the brain's file system at the path specified in the
args array, enabling tool-based access without direct filesystem reads.
<!-- aide-config-end -->

<!-- aide-playbook-index-start -->
# Coding playbook

An entry point for coding conventions, patterns, and architecture
decisions. Read this index first, then drill into the section that
matches your task.

## Task routing

| Task type | Read first |
| --------- | ---------- |
| Naming    | Foundations |
| Testing   | Workflow |

### Sections

(Add sections here as your playbook grows. Each section reference
uses a path like \${name}/section-name for advanced templating.)
<!-- aide-playbook-index-end -->

<!-- aide-study-playbook-start -->
# Study playbook

Start at the playbook hub — it lists every section with a one-line
description. Match your task domain to the description, then open
only that section's hub. Drill into the specific child notes whose
keywords overlap with the work at hand. When a content note links
to a deeper note that adds task context, follow it one level; stop
when the next link diverges from the domain you are working in.
Never re-read a note you already have in context.
<!-- aide-study-playbook-end -->

<!-- aide-update-playbook-start -->
When a coding pattern changes or a new convention is established,
update the playbook so the next agent session benefits from it.
Open the relevant playbook section hub, locate the appropriate child
note, and edit the content in place. If the pattern is genuinely new,
add a new child note and register it in the section hub. Keep entries
concise: state the rule, show a minimal example, and link related notes.
Commit the playbook update alongside the code change that motivated it.
<!-- aide-update-playbook-end -->

<!-- aide-research-index-start -->
# Research

An entry point for domain research material. Each subdirectory holds
material for a single domain; read the domain entry point before
drilling into individual files.

## Domains

(Add domain entry points here as your research grows.)

### Example domain

A \${name} placeholder here proves verbatim pass-through in the
research section.
<!-- aide-research-index-end -->
`;

// 3a. CANONICAL_CONFIG — frontmatter shape unchanged; name updated to "my-brain"
// (storage-agnostic label; the parser treats `name` as metadata only).
const CANONICAL_CONFIG: BrainAideConfig = {
	name: "my-brain",
	mcpServerConfig: {
		command: "npx",
		args: ["@example/mcp-launcher", "D:/brains/my-brain"],
	},
};

// ---------------------------------------------------------------------------
// Test helper: extract the verbatim bytes for a named section from the
// CANONICAL_BRAIN_AIDE fixture using the marker grammar.
//
// Reconstructs the body the same way parseBrainAideFromString does:
// split off the frontmatter (drop the closing `---\n`), strip one leading `\n`,
// then locate the opener and closer for the named section and slice verbatim
// bytes between them (open.index + open.length) → close.index.
// ---------------------------------------------------------------------------

const MARKER_OPENERS: Record<
	"orientation" | "config" | "playbookIndex" | "studyPlaybook" | "updatePlaybook" | "researchIndex",
	string
> = {
	orientation: "<!-- aide-orientation-start -->",
	config: "<!-- aide-config-start -->",
	playbookIndex: "<!-- aide-playbook-index-start -->",
	studyPlaybook: "<!-- aide-study-playbook-start -->",
	updatePlaybook: "<!-- aide-update-playbook-start -->",
	researchIndex: "<!-- aide-research-index-start -->",
};
const MARKER_CLOSERS: Record<
	"orientation" | "config" | "playbookIndex" | "studyPlaybook" | "updatePlaybook" | "researchIndex",
	string
> = {
	orientation: "<!-- aide-orientation-end -->",
	config: "<!-- aide-config-end -->",
	playbookIndex: "<!-- aide-playbook-index-end -->",
	studyPlaybook: "<!-- aide-study-playbook-end -->",
	updatePlaybook: "<!-- aide-update-playbook-end -->",
	researchIndex: "<!-- aide-research-index-end -->",
};

function extractCanonicalSection(
	name: "orientation" | "config" | "playbookIndex" | "studyPlaybook" | "updatePlaybook" | "researchIndex",
): string {
	// Reconstruct the body the same way parseBrainAideFromString does:
	// drop opening `---`, find closing `\n---`, take everything after it,
	// then strip one leading `\n`.
	const afterOpen = CANONICAL_BRAIN_AIDE.trimStart().slice(3); // drop opening ---
	const closeIndex = afterOpen.indexOf("\n---");
	const body = afterOpen.slice(closeIndex + 4).replace(/^\n/, "");

	const opener = MARKER_OPENERS[name];
	const closer = MARKER_CLOSERS[name];

	const openIdx = body.indexOf(opener);
	const closeIdx = body.indexOf(closer);

	return body.slice(openIdx + opener.length, closeIdx);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function writeBrainAide(root: string, content: string): Promise<void> {
	await mkdir(join(root, ".aide", "config"), { recursive: true });
	await writeFile(join(root, ".aide", "config", "brain.aide"), content, "utf-8");
}

/**
 * Build a minimal valid six-section brain.aide content string using
 * the marker-pair body grammar. All six required marker pairs are present
 * in the correct orientation-then-config-then-playbookIndex-then-studyPlaybook-then-updatePlaybook-then-researchIndex order.
 *
 * The optional `argsLines` override replaces the default two-element args block
 * (lines `    - "@example/mcp-launcher"` and `    - "D:/brains/my-brain"`) with
 * the caller-supplied indented YAML lines. Use this to inject YAML null entries
 * (bare `-` with no scalar) or arbitrary args shapes without touching any other
 * fixture property. Each element of `argsLines` must be a string of the form
 * `    - <value>` (four-space indent, matching the enclosing frontmatter block).
 */
function makeCanonicalContent(overrides?: {
	name?: string;
	extraFrontmatterLines?: string[];
	argsLines?: string[];
	orientationBody?: string;
	configBody?: string;
	playbookIndexBody?: string;
	studyPlaybookBody?: string;
	updatePlaybookBody?: string;
	researchIndexBody?: string;
}): string {
	const name = overrides?.name ?? "my-brain";
	const extra = overrides?.extraFrontmatterLines ?? [];
	const orientation = overrides?.orientationBody ?? "Some orientation body.\n";
	const config = overrides?.configBody ?? "Some config body.\n";
	const playbookIndex = overrides?.playbookIndexBody ?? "Some playbook index body.\n";
	const studyPlaybook = overrides?.studyPlaybookBody ?? "Some study playbook body.\n";
	const updatePlaybook = overrides?.updatePlaybookBody ?? "Some update playbook body.\n";
	const researchIndex = overrides?.researchIndexBody ?? "Some research index body.\n";

	const defaultArgsLines = ['    - "@example/mcp-launcher"', '    - "D:/brains/my-brain"'];
	const argsBlock = (overrides?.argsLines ?? defaultArgsLines).join("\n");

	const frontmatterLines = [
		`name: ${name}`,
		"mcpServerConfig:",
		"  command: npx",
		"  args:",
		argsBlock,
		...extra,
	];

	return (
		`---\n${frontmatterLines.join("\n")}\n---\n\n` +
		`<!-- aide-orientation-start -->\n${orientation}<!-- aide-orientation-end -->\n\n` +
		`<!-- aide-config-start -->\n${config}<!-- aide-config-end -->\n\n` +
		`<!-- aide-playbook-index-start -->\n${playbookIndex}<!-- aide-playbook-index-end -->\n\n` +
		`<!-- aide-study-playbook-start -->\n${studyPlaybook}<!-- aide-study-playbook-end -->\n\n` +
		`<!-- aide-update-playbook-start -->\n${updatePlaybook}<!-- aide-update-playbook-end -->\n\n` +
		`<!-- aide-research-index-start -->\n${researchIndex}<!-- aide-research-index-end -->\n`
	);
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
// 3b. Happy path — asserts on all six body fields (marker grammar)
// ---------------------------------------------------------------------------

describe("3a — happy path", () => {
	it("returns ok with flattened frontmatter fields and all six body sections", async () => {
		await writeBrainAide(tempDir, CANONICAL_BRAIN_AIDE);

		const result = await parseBrainAide(tempDir);

		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return;

		expect(result.name).toBe("my-brain");
		expect(result.mcpServerConfig.command).toBe("npx");
		expect(result.mcpServerConfig.args).toEqual(["@example/mcp-launcher", "D:/brains/my-brain"]);

		// orientation: verbatim bytes between <!-- aide-orientation-start --> and <!-- aide-orientation-end -->
		expect(result.orientation).toBe(extractCanonicalSection("orientation"));
		expect(result.orientation).toMatch(/Your brain is an external knowledge store/);

		// config: verbatim bytes between <!-- aide-config-start --> and <!-- aide-config-end -->
		expect(result.config).toBe(extractCanonicalSection("config"));

		// playbookIndex: verbatim bytes between <!-- aide-playbook-index-start --> and <!-- aide-playbook-index-end -->
		expect(result.playbookIndex).toBe(extractCanonicalSection("playbookIndex"));

		// studyPlaybook: verbatim bytes between <!-- aide-study-playbook-start --> and <!-- aide-study-playbook-end -->
		expect(result.studyPlaybook).toBe(extractCanonicalSection("studyPlaybook"));
		expect(result.studyPlaybook).toMatch(/Start at the playbook hub/);

		// updatePlaybook: verbatim bytes between <!-- aide-update-playbook-start --> and <!-- aide-update-playbook-end -->
		expect(result.updatePlaybook).toBe(extractCanonicalSection("updatePlaybook"));

		// researchIndex: verbatim bytes between <!-- aide-research-index-start --> and <!-- aide-research-index-end -->
		expect(result.researchIndex).toBe(extractCanonicalSection("researchIndex"));
	});

	it("literal # H1 and ## headings inside sections pass through verbatim — marker grammar is bytes not lines", async () => {
		// The CANONICAL_BRAIN_AIDE fixture includes `# Coding playbook` (H1) and `## Task routing`
		// and `### Sections` inside the playbookIndex section, plus `# Study playbook` (H1) inside the
		// studyPlaybook section, plus `# Research`, `## Domains`, and `### Example domain` inside the
		// researchIndex section. The marker walker slices between marker byte offsets — it never inspects
		// line structure, so these heading characters are content.
		await writeBrainAide(tempDir, CANONICAL_BRAIN_AIDE);
		const result = await parseBrainAide(tempDir);

		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return;

		expect(result.playbookIndex).toContain("# Coding playbook");
		expect(result.playbookIndex).toContain("## Task routing");
		expect(result.playbookIndex).toContain("### Sections");
		expect(result.studyPlaybook).toContain("# Study playbook");
		expect(result.researchIndex).toContain("# Research");
		expect(result.researchIndex).toContain("## Domains");
		expect(result.researchIndex).toContain("### Example domain");
	});
});

// ---------------------------------------------------------------------------
// 3c. Missing file — structurally unchanged; no body to update
// ---------------------------------------------------------------------------

describe("3b — missing file", () => {
	it("returns missing when no .aide/config/brain.aide exists — never throws", async () => {
		const result = await parseBrainAide(tempDir);

		expect(result.kind).toBe("missing");
	});
});

// ---------------------------------------------------------------------------
// 3c. Malformed YAML — fixture body updated to use six marker pairs
// ---------------------------------------------------------------------------

describe("3c — malformed YAML frontmatter", () => {
	it("returns malformed-frontmatter with a non-empty reason for invalid YAML", async () => {
		const badYaml = `---
mcpServerConfig:
  args: [unclosed bracket
---

<!-- aide-orientation-start -->
Some orientation.
<!-- aide-orientation-end -->

<!-- aide-config-start -->
Some config.
<!-- aide-config-end -->

<!-- aide-playbook-index-start -->
Some playbook index.
<!-- aide-playbook-index-end -->

<!-- aide-study-playbook-start -->
Some study playbook.
<!-- aide-study-playbook-end -->

<!-- aide-update-playbook-start -->
Some update playbook.
<!-- aide-update-playbook-end -->

<!-- aide-research-index-start -->
Some research index.
<!-- aide-research-index-end -->
`;
		await writeBrainAide(tempDir, badYaml);

		const result = await parseBrainAide(tempDir);

		expect(result.kind).toBe("malformed-frontmatter");
		if (result.kind !== "malformed-frontmatter") return;
		expect(result.reason.length).toBeGreaterThan(0);
	});
});

// ---------------------------------------------------------------------------
// 3d. Missing required field (parameterized) — bodies updated to six marker pairs
// ---------------------------------------------------------------------------

describe("3d — missing required field", () => {
	function makeContentMissing(field: string): string {
		let frontmatterLines: string[];

		if (field === "name") {
			frontmatterLines = [
				"mcpServerConfig:",
				"  command: npx",
				"  args:",
				'    - "@example/mcp-launcher"',
				'    - "D:/brains/my-brain"',
			];
		} else if (field === "mcpServerConfig.command") {
			frontmatterLines = [
				"name: my-brain",
				"mcpServerConfig:",
				"  args:",
				'    - "@example/mcp-launcher"',
				'    - "D:/brains/my-brain"',
			];
		} else if (field === "mcpServerConfig.args") {
			frontmatterLines = [
				"name: my-brain",
				"mcpServerConfig:",
				"  command: npx",
			];
		} else {
			frontmatterLines = [
				"name: my-brain",
				"mcpServerConfig:",
				"  command: npx",
				"  args:",
				'    - "@example/mcp-launcher"',
				'    - "D:/brains/my-brain"',
			];
		}

		return (
			`---\n${frontmatterLines.join("\n")}\n---\n\n` +
			`<!-- aide-orientation-start -->\nSome orientation body.\n<!-- aide-orientation-end -->\n\n` +
			`<!-- aide-config-start -->\nSome config body.\n<!-- aide-config-end -->\n\n` +
			`<!-- aide-playbook-index-start -->\nSome playbook index body.\n<!-- aide-playbook-index-end -->\n\n` +
			`<!-- aide-study-playbook-start -->\nSome study playbook body.\n<!-- aide-study-playbook-end -->\n\n` +
			`<!-- aide-update-playbook-start -->\nSome update playbook body.\n<!-- aide-update-playbook-end -->\n\n` +
			`<!-- aide-research-index-start -->\nSome research index body.\n<!-- aide-research-index-end -->\n`
		);
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
		expect(result.reason).toContain(field);
	});
});

// ---------------------------------------------------------------------------
// 3d'. Deprecated-field rejection (parameterized) — bodies updated to six marker pairs
// ---------------------------------------------------------------------------

describe("3d' — deprecated field rejection", () => {
	const cases: Array<[description: string, extraLines: string[], expectedReason: string]> = [
		[
			"single deprecated field: connector",
			["connector: some-backend"],
			"deprecated fields: connector",
		],
		[
			"single deprecated field: rootPath",
			["rootPath: D:/brains/my-brain"],
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
			["rootPath: D:/brains/my-brain", "tools:", "  read: mcp__brain__read_note", "  search: mcp__brain__search_notes"],
			"deprecated fields: rootPath, tools",
		],
		[
			"multiple deprecated fields: connector + entryFile listed in deprecated-set order",
			["connector: some-backend", "entryFile: CLAUDE.md"],
			"deprecated fields: connector, entryFile",
		],
		[
			"all four deprecated fields: reason lists all in set order",
			[
				"connector: some-backend",
				"rootPath: D:/brains/my-brain",
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
			"name: my-brain",
			"mcpServerConfig:",
			"  command: npx",
			"  args:",
			'    - "@example/mcp-launcher"',
			'    - "D:/brains/my-brain"',
		];
		const frontmatter = [...requiredLines, ...extraLines].join("\n");
		const content =
			`---\n${frontmatter}\n---\n\n` +
			`<!-- aide-orientation-start -->\nSome orientation body.\n<!-- aide-orientation-end -->\n\n` +
			`<!-- aide-config-start -->\nSome config body.\n<!-- aide-config-end -->\n\n` +
			`<!-- aide-playbook-index-start -->\nSome playbook index body.\n<!-- aide-playbook-index-end -->\n\n` +
			`<!-- aide-study-playbook-start -->\nSome study playbook body.\n<!-- aide-study-playbook-end -->\n\n` +
			`<!-- aide-update-playbook-start -->\nSome update playbook body.\n<!-- aide-update-playbook-end -->\n\n` +
			`<!-- aide-research-index-start -->\nSome research index body.\n<!-- aide-research-index-end -->\n`;

		await writeBrainAide(tempDir, content);

		const result = await parseBrainAide(tempDir);

		expect(result.kind).toBe("malformed-frontmatter");
		if (result.kind !== "malformed-frontmatter") return;
		expect(result.reason).toBe(expectedReason);
	});
});

// ---------------------------------------------------------------------------
// 3e. Missing required sections (parameterized) — replaces old heading-based test.
//
// Cases cover every missing-pair combination plus unmatched-opener and
// unmatched-closer (one marker of a pair present, other missing).
// Each case asserts kind === "malformed-body" and the reason matches literally.
// ---------------------------------------------------------------------------

describe("3e — missing required sections (parameterized)", () => {
	const validFrontmatter =
		`---\nname: my-brain\nmcpServerConfig:\n  command: npx\n  args:\n    - "@example/mcp-launcher"\n    - "D:/brains/my-brain"\n---\n\n`;

	// Helper: build a body that includes only the specified markers (by exact token),
	// each with a short content string between them.
	// For unmatched cases we just list markers in order with content between.
	function bodyWithMarkers(markers: string[]): string {
		return markers.join("\nSome content.\n") + "\nSome content.\n";
	}

	// Missing-pair cases: all markers present except the named pair(s).
	const allMarkers = [
		"<!-- aide-orientation-start -->",
		"<!-- aide-orientation-end -->",
		"<!-- aide-config-start -->",
		"<!-- aide-config-end -->",
		"<!-- aide-playbook-index-start -->",
		"<!-- aide-playbook-index-end -->",
		"<!-- aide-study-playbook-start -->",
		"<!-- aide-study-playbook-end -->",
		"<!-- aide-update-playbook-start -->",
		"<!-- aide-update-playbook-end -->",
		"<!-- aide-research-index-start -->",
		"<!-- aide-research-index-end -->",
	];

	const missingPairCases: Array<[string, string, string]> = [
		[
			"missing orientation pair only",
			validFrontmatter + bodyWithMarkers(allMarkers.filter((m) => !m.includes("orientation"))),
			"missing markers: <!-- aide-orientation-start -->, <!-- aide-orientation-end -->",
		],
		[
			"missing config pair only",
			validFrontmatter + bodyWithMarkers(allMarkers.filter((m) => !m.includes("aide-config-"))),
			"missing markers: <!-- aide-config-start -->, <!-- aide-config-end -->",
		],
		[
			"missing playbookIndex pair only",
			validFrontmatter + bodyWithMarkers(allMarkers.filter((m) => !m.includes("playbook-index"))),
			"missing markers: <!-- aide-playbook-index-start -->, <!-- aide-playbook-index-end -->",
		],
		[
			"missing studyPlaybook pair only",
			validFrontmatter + bodyWithMarkers(allMarkers.filter((m) => !m.includes("study-playbook"))),
			"missing markers: <!-- aide-study-playbook-start -->, <!-- aide-study-playbook-end -->",
		],
		[
			"missing updatePlaybook pair only",
			validFrontmatter + bodyWithMarkers(allMarkers.filter((m) => !m.includes("update-playbook"))),
			"missing markers: <!-- aide-update-playbook-start -->, <!-- aide-update-playbook-end -->",
		],
		[
			"missing researchIndex pair only",
			validFrontmatter + bodyWithMarkers(allMarkers.filter((m) => !m.includes("research-index"))),
			"missing markers: <!-- aide-research-index-start -->, <!-- aide-research-index-end -->",
		],
		[
			"missing orientation and researchIndex pairs",
			validFrontmatter + bodyWithMarkers(allMarkers.filter((m) => !m.includes("orientation") && !m.includes("research-index"))),
			"missing markers: <!-- aide-orientation-start -->, <!-- aide-orientation-end -->, <!-- aide-research-index-start -->, <!-- aide-research-index-end -->",
		],
		[
			"missing orientation and playbookIndex pairs",
			validFrontmatter + bodyWithMarkers(allMarkers.filter((m) => !m.includes("orientation") && !m.includes("playbook-index"))),
			"missing markers: <!-- aide-orientation-start -->, <!-- aide-orientation-end -->, <!-- aide-playbook-index-start -->, <!-- aide-playbook-index-end -->",
		],
		[
			"missing playbookIndex and researchIndex pairs",
			validFrontmatter + bodyWithMarkers(allMarkers.filter((m) => !m.includes("playbook-index") && !m.includes("research-index"))),
			"missing markers: <!-- aide-playbook-index-start -->, <!-- aide-playbook-index-end -->, <!-- aide-research-index-start -->, <!-- aide-research-index-end -->",
		],
		[
			"missing orientation and studyPlaybook pairs",
			validFrontmatter + bodyWithMarkers(allMarkers.filter((m) => !m.includes("orientation") && !m.includes("study-playbook"))),
			"missing markers: <!-- aide-orientation-start -->, <!-- aide-orientation-end -->, <!-- aide-study-playbook-start -->, <!-- aide-study-playbook-end -->",
		],
		[
			"missing playbookIndex and studyPlaybook pairs",
			validFrontmatter + bodyWithMarkers(allMarkers.filter((m) => !m.includes("playbook-index") && !m.includes("study-playbook"))),
			"missing markers: <!-- aide-playbook-index-start -->, <!-- aide-playbook-index-end -->, <!-- aide-study-playbook-start -->, <!-- aide-study-playbook-end -->",
		],
		[
			"missing studyPlaybook and researchIndex pairs",
			validFrontmatter + bodyWithMarkers(allMarkers.filter((m) => !m.includes("study-playbook") && !m.includes("research-index"))),
			"missing markers: <!-- aide-study-playbook-start -->, <!-- aide-study-playbook-end -->, <!-- aide-research-index-start -->, <!-- aide-research-index-end -->",
		],
	];

	it.each(missingPairCases)("%s → malformed-body", async (_description, content, expectedReason) => {
		await writeBrainAide(tempDir, content);
		const result = await parseBrainAide(tempDir);

		expect(result.kind).toBe("malformed-body");
		if (result.kind !== "malformed-body") return;
		expect(result.reason).toBe(expectedReason);
	});

	// Unmatched-opener case: opener present, closer missing.
	it("orientation opener present but closer missing → unmatched opening marker", async () => {
		const content =
			validFrontmatter +
			`<!-- aide-orientation-start -->\nSome orientation.\n\n` +
			`<!-- aide-config-start -->\nSome config.\n<!-- aide-config-end -->\n\n` +
			`<!-- aide-playbook-index-start -->\nSome playbook index.\n<!-- aide-playbook-index-end -->\n\n` +
			`<!-- aide-study-playbook-start -->\nSome study playbook.\n<!-- aide-study-playbook-end -->\n\n` +
			`<!-- aide-update-playbook-start -->\nSome update playbook.\n<!-- aide-update-playbook-end -->\n\n` +
			`<!-- aide-research-index-start -->\nSome research index.\n<!-- aide-research-index-end -->\n`;

		await writeBrainAide(tempDir, content);
		const result = await parseBrainAide(tempDir);

		expect(result.kind).toBe("malformed-body");
		if (result.kind !== "malformed-body") return;
		expect(result.reason).toBe(
			"unmatched opening marker: <!-- aide-orientation-start --> has no matching <!-- aide-orientation-end -->",
		);
	});

	// Unmatched-closer case: closer present, opener missing.
	it("orientation closer present but opener missing → unmatched closing marker", async () => {
		const content =
			validFrontmatter +
			`Some orientation content without an opener.\n<!-- aide-orientation-end -->\n\n` +
			`<!-- aide-config-start -->\nSome config.\n<!-- aide-config-end -->\n\n` +
			`<!-- aide-playbook-index-start -->\nSome playbook index.\n<!-- aide-playbook-index-end -->\n\n` +
			`<!-- aide-study-playbook-start -->\nSome study playbook.\n<!-- aide-study-playbook-end -->\n\n` +
			`<!-- aide-update-playbook-start -->\nSome update playbook.\n<!-- aide-update-playbook-end -->\n\n` +
			`<!-- aide-research-index-start -->\nSome research index.\n<!-- aide-research-index-end -->\n`;

		await writeBrainAide(tempDir, content);
		const result = await parseBrainAide(tempDir);

		expect(result.kind).toBe("malformed-body");
		if (result.kind !== "malformed-body") return;
		expect(result.reason).toBe(
			"unmatched closing marker: <!-- aide-orientation-end --> appeared without a prior <!-- aide-orientation-start -->",
		);
	});

	// Unmatched-opener case for studyPlaybook section.
	it("studyPlaybook opener present but closer missing → unmatched opening marker", async () => {
		const content =
			validFrontmatter +
			`<!-- aide-orientation-start -->\nSome orientation.\n<!-- aide-orientation-end -->\n\n` +
			`<!-- aide-config-start -->\nSome config.\n<!-- aide-config-end -->\n\n` +
			`<!-- aide-playbook-index-start -->\nSome playbook index.\n<!-- aide-playbook-index-end -->\n\n` +
			`<!-- aide-study-playbook-start -->\nSome study playbook.\n\n` +
			`<!-- aide-update-playbook-start -->\nSome update playbook.\n<!-- aide-update-playbook-end -->\n\n` +
			`<!-- aide-research-index-start -->\nSome research index.\n<!-- aide-research-index-end -->\n`;

		await writeBrainAide(tempDir, content);
		const result = await parseBrainAide(tempDir);

		expect(result.kind).toBe("malformed-body");
		if (result.kind !== "malformed-body") return;
		expect(result.reason).toBe(
			"unmatched opening marker: <!-- aide-study-playbook-start --> has no matching <!-- aide-study-playbook-end -->",
		);
	});

	// Unmatched-closer case for studyPlaybook section.
	it("studyPlaybook closer present but opener missing → unmatched closing marker", async () => {
		const content =
			validFrontmatter +
			`<!-- aide-orientation-start -->\nSome orientation.\n<!-- aide-orientation-end -->\n\n` +
			`<!-- aide-config-start -->\nSome config.\n<!-- aide-config-end -->\n\n` +
			`<!-- aide-playbook-index-start -->\nSome playbook index.\n<!-- aide-playbook-index-end -->\n\n` +
			`Some study playbook content without an opener.\n<!-- aide-study-playbook-end -->\n\n` +
			`<!-- aide-update-playbook-start -->\nSome update playbook.\n<!-- aide-update-playbook-end -->\n\n` +
			`<!-- aide-research-index-start -->\nSome research index.\n<!-- aide-research-index-end -->\n`;

		await writeBrainAide(tempDir, content);
		const result = await parseBrainAide(tempDir);

		expect(result.kind).toBe("malformed-body");
		if (result.kind !== "malformed-body") return;
		expect(result.reason).toBe(
			"unmatched closing marker: <!-- aide-study-playbook-end --> appeared without a prior <!-- aide-study-playbook-start -->",
		);
	});
});

// ---------------------------------------------------------------------------
// 3f. Malformed / typo'd marker rejection.
//
// Parameterized it.each over the case set from the spec's "Bad examples" block.
// Each fixture has valid frontmatter and a body where one recognized marker is
// replaced by a malformed variant; the other eleven recognized markers are correctly
// present and paired. Each case asserts kind === "malformed-body" and the reason
// matches the literal "unknown marker: <as-written>" format.
// ---------------------------------------------------------------------------

describe("3f — malformed/typo'd marker rejection", () => {
	const validFrontmatter =
		`---\nname: my-brain\nmcpServerConfig:\n  command: npx\n  args:\n    - "@example/mcp-launcher"\n    - "D:/brains/my-brain"\n---\n\n`;

	/**
	 * Build a body where the orientation opener is replaced by the given malformed marker.
	 * The remaining eleven recognized markers are correctly present and paired, so the
	 * only failure is the substituted malformed token.
	 */
	function bodyWithMalformedOrientationOpener(malformedMarker: string): string {
		return (
			`${malformedMarker}\nSome orientation.\n<!-- aide-orientation-end -->\n\n` +
			`<!-- aide-config-start -->\nSome config.\n<!-- aide-config-end -->\n\n` +
			`<!-- aide-playbook-index-start -->\nSome playbook index.\n<!-- aide-playbook-index-end -->\n\n` +
			`<!-- aide-study-playbook-start -->\nSome study playbook.\n<!-- aide-study-playbook-end -->\n\n` +
			`<!-- aide-update-playbook-start -->\nSome update playbook.\n<!-- aide-update-playbook-end -->\n\n` +
			`<!-- aide-research-index-start -->\nSome research index.\n<!-- aide-research-index-end -->\n`
		);
	}

	/**
	 * Build a body where the study-playbook opener is replaced by the given malformed marker.
	 * The remaining eleven recognized markers are correctly present and paired, so the
	 * only failure is the substituted malformed token.
	 */
	function bodyWithMalformedStudyPlaybookOpener(malformedMarker: string): string {
		return (
			`<!-- aide-orientation-start -->\nSome orientation.\n<!-- aide-orientation-end -->\n\n` +
			`<!-- aide-config-start -->\nSome config.\n<!-- aide-config-end -->\n\n` +
			`<!-- aide-playbook-index-start -->\nSome playbook index.\n<!-- aide-playbook-index-end -->\n\n` +
			`${malformedMarker}\nSome study playbook.\n<!-- aide-study-playbook-end -->\n\n` +
			`<!-- aide-update-playbook-start -->\nSome update playbook.\n<!-- aide-update-playbook-end -->\n\n` +
			`<!-- aide-research-index-start -->\nSome research index.\n<!-- aide-research-index-end -->\n`
		);
	}

	const malformedCases: Array<[string, string, string]> = [
		[
			"uppercase variant",
			bodyWithMalformedOrientationOpener("<!-- AIDE-ORIENTATION-START -->"),
			"unknown marker: <!-- AIDE-ORIENTATION-START -->",
		],
		[
			"mixed-case variant",
			bodyWithMalformedOrientationOpener("<!-- Aide-orientation-start -->"),
			"unknown marker: <!-- Aide-orientation-start -->",
		],
		[
			"no surrounding spaces",
			bodyWithMalformedOrientationOpener("<!--aide-orientation-start-->"),
			"unknown marker: <!--aide-orientation-start-->",
		],
		[
			"extra internal whitespace (trailing)",
			bodyWithMalformedOrientationOpener("<!-- aide-orientation-start  -->"),
			"unknown marker: <!-- aide-orientation-start  -->",
		],
		[
			"extra internal whitespace (leading)",
			bodyWithMalformedOrientationOpener("<!--  aide-orientation-start -->"),
			"unknown marker: <!--  aide-orientation-start -->",
		],
		[
			"missing aide- prefix",
			bodyWithMalformedOrientationOpener("<!-- orientation-start -->"),
			"unknown marker: <!-- orientation-start -->",
		],
		[
			"typo in token (strart)",
			bodyWithMalformedOrientationOpener("<!-- aide-orientation-strart -->"),
			"unknown marker: <!-- aide-orientation-strart -->",
		],
		[
			"typo in section name (playbook-iindex)",
			(
				`<!-- aide-orientation-start -->\nSome orientation.\n<!-- aide-orientation-end -->\n\n` +
				`<!-- aide-config-start -->\nSome config.\n<!-- aide-config-end -->\n\n` +
				`<!-- aide-playbook-iindex-start -->\nSome playbook index.\n<!-- aide-playbook-index-end -->\n\n` +
				`<!-- aide-study-playbook-start -->\nSome study playbook.\n<!-- aide-study-playbook-end -->\n\n` +
				`<!-- aide-update-playbook-start -->\nSome update playbook.\n<!-- aide-update-playbook-end -->\n\n` +
				`<!-- aide-research-index-start -->\nSome research index.\n<!-- aide-research-index-end -->\n`
			),
			"unknown marker: <!-- aide-playbook-iindex-start -->",
		],
		[
			"typo in study-playbook section name (study-pllaybook)",
			(
				`<!-- aide-orientation-start -->\nSome orientation.\n<!-- aide-orientation-end -->\n\n` +
				`<!-- aide-config-start -->\nSome config.\n<!-- aide-config-end -->\n\n` +
				`<!-- aide-playbook-index-start -->\nSome playbook index.\n<!-- aide-playbook-index-end -->\n\n` +
				`<!-- aide-study-pllaybook-start -->\nSome study playbook.\n<!-- aide-study-playbook-end -->\n\n` +
				`<!-- aide-update-playbook-start -->\nSome update playbook.\n<!-- aide-update-playbook-end -->\n\n` +
				`<!-- aide-research-index-start -->\nSome research index.\n<!-- aide-research-index-end -->\n`
			),
			"unknown marker: <!-- aide-study-pllaybook-start -->",
		],
		[
			"uppercase variant of study-playbook opener",
			bodyWithMalformedStudyPlaybookOpener("<!-- AIDE-STUDY-PLAYBOOK-START -->"),
			"unknown marker: <!-- AIDE-STUDY-PLAYBOOK-START -->",
		],
	];

	it.each(malformedCases)("%s → malformed-body with unknown marker reason", async (_description, body, expectedReason) => {
		const content = validFrontmatter + body;
		await writeBrainAide(tempDir, content);

		const result = await parseBrainAide(tempDir);

		expect(result.kind).toBe("malformed-body");
		if (result.kind !== "malformed-body") return;
		expect(result.reason).toBe(expectedReason);
	});

	it("left-to-right ordering: two malformed markers — reason names the FIRST encountered", async () => {
		// Body has two malformed markers: an uppercase orientation opener AND a mixed-case
		// config opener. The parser surfaces one error per parse; it must name the
		// first malformed marker encountered left-to-right in document order.
		const content =
			validFrontmatter +
			`<!-- AIDE-ORIENTATION-START -->\nSome orientation.\n<!-- aide-orientation-end -->\n\n` +
			`<!-- Aide-config-start -->\nSome config.\n<!-- aide-config-end -->\n\n` +
			`<!-- aide-playbook-index-start -->\nSome playbook index.\n<!-- aide-playbook-index-end -->\n\n` +
			`<!-- aide-study-playbook-start -->\nSome study playbook.\n<!-- aide-study-playbook-end -->\n\n` +
			`<!-- aide-update-playbook-start -->\nSome update playbook.\n<!-- aide-update-playbook-end -->\n\n` +
			`<!-- aide-research-index-start -->\nSome research index.\n<!-- aide-research-index-end -->\n`;

		await writeBrainAide(tempDir, content);
		const result = await parseBrainAide(tempDir);

		expect(result.kind).toBe("malformed-body");
		if (result.kind !== "malformed-body") return;
		// The first malformed marker left-to-right is <!-- AIDE-ORIENTATION-START -->.
		expect(result.reason).toBe("unknown marker: <!-- AIDE-ORIENTATION-START -->");
	});
});

// ---------------------------------------------------------------------------
// 3g. Marker order violation.
//
// Parameterized cases for wrong order. Each fixture has all six pairs
// present and correctly matched; only the ORDER is wrong. Each case asserts
// kind === "malformed-body" and the literal reason.
// ---------------------------------------------------------------------------

describe("3g — marker order violation", () => {
	const validFrontmatter =
		`---\nname: my-brain\nmcpServerConfig:\n  command: npx\n  args:\n    - "@example/mcp-launcher"\n    - "D:/brains/my-brain"\n---\n\n`;

	const orderCases: Array<[string, string, string]> = [
		[
			"config before orientation",
			validFrontmatter +
			`<!-- aide-config-start -->\nSome config.\n<!-- aide-config-end -->\n\n` +
			`<!-- aide-orientation-start -->\nSome orientation.\n<!-- aide-orientation-end -->\n\n` +
			`<!-- aide-playbook-index-start -->\nSome playbook index.\n<!-- aide-playbook-index-end -->\n\n` +
			`<!-- aide-study-playbook-start -->\nSome study playbook.\n<!-- aide-study-playbook-end -->\n\n` +
			`<!-- aide-update-playbook-start -->\nSome update playbook.\n<!-- aide-update-playbook-end -->\n\n` +
			`<!-- aide-research-index-start -->\nSome research index.\n<!-- aide-research-index-end -->\n`,
			"marker order violation: <!-- aide-config-start --> appeared before <!-- aide-orientation-start -->",
		],
		[
			"researchIndex before playbookIndex (orientation and config first, correctly)",
			validFrontmatter +
			`<!-- aide-orientation-start -->\nSome orientation.\n<!-- aide-orientation-end -->\n\n` +
			`<!-- aide-config-start -->\nSome config.\n<!-- aide-config-end -->\n\n` +
			`<!-- aide-research-index-start -->\nSome research index.\n<!-- aide-research-index-end -->\n\n` +
			`<!-- aide-playbook-index-start -->\nSome playbook index.\n<!-- aide-playbook-index-end -->\n\n` +
			`<!-- aide-study-playbook-start -->\nSome study playbook.\n<!-- aide-study-playbook-end -->\n\n` +
			`<!-- aide-update-playbook-start -->\nSome update playbook.\n<!-- aide-update-playbook-end -->\n`,
			"marker order violation: <!-- aide-research-index-start --> appeared before <!-- aide-playbook-index-start -->",
		],
		[
			"researchIndex first (before orientation and config)",
			validFrontmatter +
			`<!-- aide-research-index-start -->\nSome research index.\n<!-- aide-research-index-end -->\n\n` +
			`<!-- aide-orientation-start -->\nSome orientation.\n<!-- aide-orientation-end -->\n\n` +
			`<!-- aide-config-start -->\nSome config.\n<!-- aide-config-end -->\n\n` +
			`<!-- aide-playbook-index-start -->\nSome playbook index.\n<!-- aide-playbook-index-end -->\n\n` +
			`<!-- aide-study-playbook-start -->\nSome study playbook.\n<!-- aide-study-playbook-end -->\n\n` +
			`<!-- aide-update-playbook-start -->\nSome update playbook.\n<!-- aide-update-playbook-end -->\n`,
			"marker order violation: <!-- aide-research-index-start --> appeared before <!-- aide-orientation-start -->",
		],
		[
			"studyPlaybook before playbookIndex",
			validFrontmatter +
			`<!-- aide-orientation-start -->\nSome orientation.\n<!-- aide-orientation-end -->\n\n` +
			`<!-- aide-config-start -->\nSome config.\n<!-- aide-config-end -->\n\n` +
			`<!-- aide-study-playbook-start -->\nSome study playbook.\n<!-- aide-study-playbook-end -->\n\n` +
			`<!-- aide-playbook-index-start -->\nSome playbook index.\n<!-- aide-playbook-index-end -->\n\n` +
			`<!-- aide-update-playbook-start -->\nSome update playbook.\n<!-- aide-update-playbook-end -->\n\n` +
			`<!-- aide-research-index-start -->\nSome research index.\n<!-- aide-research-index-end -->\n`,
			"marker order violation: <!-- aide-study-playbook-start --> appeared before <!-- aide-playbook-index-start -->",
		],
		[
			"researchIndex before studyPlaybook",
			validFrontmatter +
			`<!-- aide-orientation-start -->\nSome orientation.\n<!-- aide-orientation-end -->\n\n` +
			`<!-- aide-config-start -->\nSome config.\n<!-- aide-config-end -->\n\n` +
			`<!-- aide-playbook-index-start -->\nSome playbook index.\n<!-- aide-playbook-index-end -->\n\n` +
			`<!-- aide-research-index-start -->\nSome research index.\n<!-- aide-research-index-end -->\n\n` +
			`<!-- aide-study-playbook-start -->\nSome study playbook.\n<!-- aide-study-playbook-end -->\n\n` +
			`<!-- aide-update-playbook-start -->\nSome update playbook.\n<!-- aide-update-playbook-end -->\n`,
			"marker order violation: <!-- aide-research-index-start --> appeared before <!-- aide-study-playbook-start -->",
		],
		[
			"updatePlaybook before studyPlaybook",
			validFrontmatter +
			`<!-- aide-orientation-start -->\nSome orientation.\n<!-- aide-orientation-end -->\n\n` +
			`<!-- aide-config-start -->\nSome config.\n<!-- aide-config-end -->\n\n` +
			`<!-- aide-playbook-index-start -->\nSome playbook index.\n<!-- aide-playbook-index-end -->\n\n` +
			`<!-- aide-update-playbook-start -->\nSome update playbook.\n<!-- aide-update-playbook-end -->\n\n` +
			`<!-- aide-study-playbook-start -->\nSome study playbook.\n<!-- aide-study-playbook-end -->\n\n` +
			`<!-- aide-research-index-start -->\nSome research index.\n<!-- aide-research-index-end -->\n`,
			"marker order violation: <!-- aide-update-playbook-start --> appeared before <!-- aide-study-playbook-start -->",
		],
	];

	it.each(orderCases)("%s → malformed-body", async (_description, content, expectedReason) => {
		await writeBrainAide(tempDir, content);

		const result = await parseBrainAide(tempDir);

		expect(result.kind).toBe("malformed-body");
		if (result.kind !== "malformed-body") return;
		expect(result.reason).toBe(expectedReason);
	});
});

// ---------------------------------------------------------------------------
// 3h. Nested marker rejection.
//
// Parameterized cases covering each nesting class. Each fixture has all twelve
// recognized marker tokens present and well-formed in document order; only
// the BYTE OFFSETS put one marker (or pair) inside another pair's span.
// Each case asserts kind === "malformed-body" and the literal reason.
// ---------------------------------------------------------------------------

describe("3h — nested marker rejection", () => {
	const validFrontmatter =
		`---\nname: my-brain\nmcpServerConfig:\n  command: npx\n  args:\n    - "@example/mcp-launcher"\n    - "D:/brains/my-brain"\n---\n\n`;

	const nestingCases: Array<[string, string, string]> = [
		[
			"playbookIndex pair nested inside config pair",
			// orientation pair, then config opener, then playbookIndex pair fully nested inside
			// the config span (openers in document order: orientation, config, playbookIndex —
			// correct required order, so the order check passes), then config closer, then the
			// remaining sections. The nesting check fires on playbookIndex inside config.
			validFrontmatter +
			`<!-- aide-orientation-start -->\nSome orientation.\n<!-- aide-orientation-end -->\n\n` +
			`<!-- aide-config-start -->\n` +
			`Some config content.\n` +
			`<!-- aide-playbook-index-start -->\nNested playbook index.\n<!-- aide-playbook-index-end -->\n` +
			`More config content.\n` +
			`<!-- aide-config-end -->\n\n` +
			`<!-- aide-study-playbook-start -->\nSome study playbook.\n<!-- aide-study-playbook-end -->\n\n` +
			`<!-- aide-update-playbook-start -->\nSome update playbook.\n<!-- aide-update-playbook-end -->\n\n` +
			`<!-- aide-research-index-start -->\nSome research index.\n<!-- aide-research-index-end -->\n`,
			"nested marker: <!-- aide-playbook-index-start --> appeared inside the config section",
		],
		[
			"config-start nested inside orientation pair",
			validFrontmatter +
			`<!-- aide-orientation-start -->\n` +
			`Some orientation content.\n` +
			`<!-- aide-config-start -->\n` +
			`More orientation content.\n` +
			`<!-- aide-orientation-end -->\n\n` +
			`<!-- aide-config-end -->\n\n` +
			`<!-- aide-playbook-index-start -->\nSome playbook index.\n<!-- aide-playbook-index-end -->\n\n` +
			`<!-- aide-study-playbook-start -->\nSome study playbook.\n<!-- aide-study-playbook-end -->\n\n` +
			`<!-- aide-update-playbook-start -->\nSome update playbook.\n<!-- aide-update-playbook-end -->\n\n` +
			`<!-- aide-research-index-start -->\nSome research index.\n<!-- aide-research-index-end -->\n`,
			"nested marker: <!-- aide-config-start --> appeared inside the orientation section",
		],
		[
			"updatePlaybook pair nested inside studyPlaybook pair",
			// orientation, config, playbookIndex pairs, then studyPlaybook opener, then
			// updatePlaybook pair fully nested inside the studyPlaybook span (openers in
			// document order: orientation, config, playbookIndex, studyPlaybook, updatePlaybook,
			// researchIndex — correct required order, order check passes), then studyPlaybook
			// closer, then researchIndex pair. The nesting check fires on updatePlaybook inside
			// studyPlaybook.
			validFrontmatter +
			`<!-- aide-orientation-start -->\nSome orientation.\n<!-- aide-orientation-end -->\n\n` +
			`<!-- aide-config-start -->\nSome config.\n<!-- aide-config-end -->\n\n` +
			`<!-- aide-playbook-index-start -->\nSome playbook index.\n<!-- aide-playbook-index-end -->\n\n` +
			`<!-- aide-study-playbook-start -->\n` +
			`Some study playbook content.\n` +
			`<!-- aide-update-playbook-start -->\nNested update playbook.\n<!-- aide-update-playbook-end -->\n` +
			`More study playbook content.\n` +
			`<!-- aide-study-playbook-end -->\n\n` +
			`<!-- aide-research-index-start -->\nSome research index.\n<!-- aide-research-index-end -->\n`,
			"nested marker: <!-- aide-update-playbook-start --> appeared inside the studyPlaybook section",
		],
		[
			"stray playbookIndex closer inside researchIndex pair",
			// All twelve markers present in correct order; researchIndex's content span
			// contains a duplicate playbookIndex closer. Openers in document order:
			// orientation-start, config-start, playbookIndex-start, studyPlaybook-start,
			// updatePlaybook-start, researchIndex-start — correct order
			// (no order violation). Unmatched-closer check passes because seenOpeners already
			// has "playbookIndex" when the inner playbook-index-end is encountered. The nesting
			// check fires because the inner playbook-index-end falls inside the researchIndex span.
			validFrontmatter +
			`<!-- aide-orientation-start -->\nSome orientation.\n<!-- aide-orientation-end -->\n\n` +
			`<!-- aide-config-start -->\nSome config.\n<!-- aide-config-end -->\n\n` +
			`<!-- aide-playbook-index-start -->\nSome playbook index.\n<!-- aide-playbook-index-end -->\n\n` +
			`<!-- aide-study-playbook-start -->\nSome study playbook.\n<!-- aide-study-playbook-end -->\n\n` +
			`<!-- aide-update-playbook-start -->\nSome update playbook.\n<!-- aide-update-playbook-end -->\n\n` +
			`<!-- aide-research-index-start -->\n` +
			`Some research content.\n` +
			`<!-- aide-playbook-index-end -->\n` +
			`More research.\n` +
			`<!-- aide-research-index-end -->\n`,
			"nested marker: <!-- aide-playbook-index-end --> appeared inside the researchIndex section",
		],
		[
			"single stray inner opener (no full inner pair) inside a pair",
			validFrontmatter +
			`<!-- aide-orientation-start -->\n` +
			`Some orientation content.\n` +
			`<!-- aide-config-start -->\n` +
			`Stray opener, no matching closer inside orientation.\n` +
			`<!-- aide-orientation-end -->\n\n` +
			`<!-- aide-config-end -->\n\n` +
			`<!-- aide-playbook-index-start -->\nSome playbook index.\n<!-- aide-playbook-index-end -->\n\n` +
			`<!-- aide-study-playbook-start -->\nSome study playbook.\n<!-- aide-study-playbook-end -->\n\n` +
			`<!-- aide-update-playbook-start -->\nSome update playbook.\n<!-- aide-update-playbook-end -->\n\n` +
			`<!-- aide-research-index-start -->\nSome research index.\n<!-- aide-research-index-end -->\n`,
			"nested marker: <!-- aide-config-start --> appeared inside the orientation section",
		],
		[
			"studyPlaybook pair nested inside playbookIndex pair",
			// The navigation prose belongs with the playbook — a tempting containment the spec names.
			// orientation pair, then playbookIndex opener, then studyPlaybook pair fully nested inside
			// the playbookIndex span, then playbookIndex closer, then config pair, then researchIndex pair.
			validFrontmatter +
			`<!-- aide-orientation-start -->\nSome orientation.\n<!-- aide-orientation-end -->\n\n` +
			`<!-- aide-config-start -->\nSome config.\n<!-- aide-config-end -->\n\n` +
			`<!-- aide-playbook-index-start -->\n` +
			`Some playbook index content.\n` +
			`<!-- aide-study-playbook-start -->\nNested study playbook.\n<!-- aide-study-playbook-end -->\n` +
			`More playbook index content.\n` +
			`<!-- aide-playbook-index-end -->\n\n` +
			`<!-- aide-update-playbook-start -->\nSome update playbook.\n<!-- aide-update-playbook-end -->\n\n` +
			`<!-- aide-research-index-start -->\nSome research index.\n<!-- aide-research-index-end -->\n`,
			"nested marker: <!-- aide-study-playbook-start --> appeared inside the playbookIndex section",
		],
		[
			"updatePlaybook-start nested inside studyPlaybook pair",
			validFrontmatter +
			`<!-- aide-orientation-start -->\nSome orientation.\n<!-- aide-orientation-end -->\n\n` +
			`<!-- aide-config-start -->\nSome config.\n<!-- aide-config-end -->\n\n` +
			`<!-- aide-playbook-index-start -->\nSome playbook index.\n<!-- aide-playbook-index-end -->\n\n` +
			`<!-- aide-study-playbook-start -->\n` +
			`Some study playbook content.\n` +
			`<!-- aide-update-playbook-start -->\n` +
			`More study playbook content.\n` +
			`<!-- aide-study-playbook-end -->\n\n` +
			`<!-- aide-update-playbook-end -->\n\n` +
			`<!-- aide-research-index-start -->\nSome research index.\n<!-- aide-research-index-end -->\n`,
			"nested marker: <!-- aide-update-playbook-start --> appeared inside the studyPlaybook section",
		],
	];

	it.each(nestingCases)("%s → malformed-body", async (_description, content, expectedReason) => {
		await writeBrainAide(tempDir, content);

		const result = await parseBrainAide(tempDir);

		expect(result.kind).toBe("malformed-body");
		if (result.kind !== "malformed-body") return;
		expect(result.reason).toBe(expectedReason);
	});
});

// ---------------------------------------------------------------------------
// 3i. Strict-failure migration: pre-pivot heading-based body.
//
// A brain.aide whose frontmatter is valid but whose body uses the OLD heading-based
// schema (## Prose / ## Playbook section / ## Research section) with NO marker pairs
// anywhere returns malformed-body naming all twelve missing markers.
//
// This test is tied to preventing the regression described in the spec's "Bad examples":
// "A parser that auto-fills missing required body sections from package defaults."
// The parser must NOT auto-detect the old heading-based shape, auto-rewrite, or
// silently default the missing sections. The user hand-edits their file.
// ---------------------------------------------------------------------------

describe("3i — strict-failure migration: pre-pivot heading-based body", () => {
	it("heading-based body with no marker pairs returns malformed-body naming all twelve missing markers", async () => {
		// This fixture uses the OLD heading-based schema — the body shape that predates
		// the marker-pair pivot. The frontmatter is valid; the body has zero marker pairs.
		const prePivotContent = `---
name: my-brain
mcpServerConfig:
  command: npx
  args:
    - "@example/mcp-launcher"
    - "D:/brains/my-brain"
---

## Prose

Your brain is an external knowledge store.

## Playbook

An entry point for coding conventions.

## Research

An entry point for domain research.
`;
		await writeBrainAide(tempDir, prePivotContent);

		const result = await parseBrainAide(tempDir);

		// The parser does NOT auto-detect the old heading-based shape.
		// It does NOT auto-rewrite; it does NOT silently default the missing sections.
		// Strict failure: all twelve missing markers listed in one reason so the user
		// fixes them all in one edit.
		expect(result.kind).toBe("malformed-body");
		if (result.kind !== "malformed-body") return;
		expect(result.reason).toBe(
			"missing markers: <!-- aide-orientation-start -->, <!-- aide-orientation-end -->, <!-- aide-config-start -->, <!-- aide-config-end -->, <!-- aide-playbook-index-start -->, <!-- aide-playbook-index-end -->, <!-- aide-study-playbook-start -->, <!-- aide-study-playbook-end -->, <!-- aide-update-playbook-start -->, <!-- aide-update-playbook-end -->, <!-- aide-research-index-start -->, <!-- aide-research-index-end -->",
		);
	});
});

// ---------------------------------------------------------------------------
// 3i'. Strict-failure migration: pre-pivot three-pair marker-bounded body.
//
// A brain.aide carrying the OLD three-pair marker-bounded body (aide-prose-*,
// aide-playbook-*, aide-research-*) returns malformed-body listing all twelve
// new markers as missing. The retired marker tokens are NOT recognized by the
// candidate regexes (they were removed from the alternation in Step 2d), so
// they fall through to the missing-markers check.
//
// Without this test a future maintainer might delete 3e's "missing studyPlaybook
// pair only" case as redundant — but that case uses a six-marker body with one
// pair removed, while this case uses the exact three-pair body shape that predates
// the six-section grammar.
// ---------------------------------------------------------------------------

describe("3i' — strict-failure migration: pre-pivot three-pair body", () => {
	it("three-pair marker-bounded body (prose + playbook + research, using retired marker names) returns malformed-body naming all twelve missing markers", async () => {
		// This fixture is the exact three-pair body shape that predates the four-section
		// grammar and the six-section grammar. The retired aide-prose-*, aide-playbook-*,
		// and aide-research-* markers are no longer recognized by the parser — they are
		// plain bytes that fall through to the missing-markers check.
		const validFrontmatter =
			`---\nname: my-brain\nmcpServerConfig:\n  command: npx\n  args:\n    - "@example/mcp-launcher"\n    - "D:/brains/my-brain"\n---\n\n`;
		const threePairBody =
			`<!-- aide-prose-start -->\nSome prose content.\n<!-- aide-prose-end -->\n\n` +
			`<!-- aide-playbook-start -->\nSome playbook content.\n<!-- aide-playbook-end -->\n\n` +
			`<!-- aide-research-start -->\nSome research content.\n<!-- aide-research-end -->\n`;
		const prePivotThreePairContent = validFrontmatter + threePairBody;

		await writeBrainAide(tempDir, prePivotThreePairContent);

		const result = await parseBrainAide(tempDir);

		// The retired marker tokens are not in the recognized set AND are not in the
		// candidate regex alternations, so they fall through to missing-markers.
		// All twelve new markers are listed as missing — the actionable migration message.
		expect(result.kind).toBe("malformed-body");
		if (result.kind !== "malformed-body") return;
		expect(result.reason).toBe(
			"missing markers: <!-- aide-orientation-start -->, <!-- aide-orientation-end -->, <!-- aide-config-start -->, <!-- aide-config-end -->, <!-- aide-playbook-index-start -->, <!-- aide-playbook-index-end -->, <!-- aide-study-playbook-start -->, <!-- aide-study-playbook-end -->, <!-- aide-update-playbook-start -->, <!-- aide-update-playbook-end -->, <!-- aide-research-index-start -->, <!-- aide-research-index-end -->",
		);
	});
});

// ---------------------------------------------------------------------------
// 3j. Bytes outside marker pairs are silently ignored.
//
// Parameterized cases for notes-to-self / scratch text in each gap position
// between the frontmatter and the first opener, between pairs, and after the
// last closer. Also includes the marker-shaped-content-outside-pairs edge case.
//
// With six sections there are now SEVEN gap positions:
//   1. frontmatter → orientation
//   2. orientation closer → config opener
//   3. config closer → playbookIndex opener
//   4. playbookIndex closer → studyPlaybook opener
//   5. studyPlaybook closer → updatePlaybook opener
//   6. updatePlaybook closer → researchIndex opener
//   7. after researchIndex closer
//
// Contract decision for the marker-shaped-outside case:
//   The malformed-marker scan respects pair boundaries — only marker-shaped tokens
//   that are NOT inside any recognized matched pair AND are not one of the twelve exact
//   recognized sequences are flagged as malformed. A token like `<!-- aide-misc -->`
//   between two recognized pairs is treated as plain bytes (per the spec's
//   "Bytes outside any marker pair are silently ignored" rule) because the scan
//   excludes regions inside recognized pairs and the token does not match any of
//   the twelve exact recognized forms.
// ---------------------------------------------------------------------------

describe("3j — bytes outside marker pairs are silently ignored", () => {
	const validFrontmatter =
		`---\nname: my-brain\nmcpServerConfig:\n  command: npx\n  args:\n    - "@example/mcp-launcher"\n    - "D:/brains/my-brain"\n---\n\n`;

	const orientationSection = `<!-- aide-orientation-start -->\nSome orientation.\n<!-- aide-orientation-end -->`;
	const configSection = `<!-- aide-config-start -->\nSome config.\n<!-- aide-config-end -->`;
	const playbookIndexSection = `<!-- aide-playbook-index-start -->\nSome playbook index.\n<!-- aide-playbook-index-end -->`;
	const studyPlaybookSection = `<!-- aide-study-playbook-start -->\nSome study playbook.\n<!-- aide-study-playbook-end -->`;
	const updatePlaybookSection = `<!-- aide-update-playbook-start -->\nSome update playbook.\n<!-- aide-update-playbook-end -->`;
	const researchIndexSection = `<!-- aide-research-index-start -->\nSome research index.\n<!-- aide-research-index-end -->`;

	const outsideCases: Array<[string, string]> = [
		[
			"scratch text between frontmatter and orientation opener",
			validFrontmatter +
			`A note-to-self before the first section.\n\n` +
			`${orientationSection}\n\n${configSection}\n\n${playbookIndexSection}\n\n${studyPlaybookSection}\n\n${updatePlaybookSection}\n\n${researchIndexSection}\n`,
		],
		[
			"scratch text between orientation closer and config opener",
			validFrontmatter +
			`${orientationSection}\n\nScratch text between orientation and config.\n\n${configSection}\n\n${playbookIndexSection}\n\n${studyPlaybookSection}\n\n${updatePlaybookSection}\n\n${researchIndexSection}\n`,
		],
		[
			"scratch text between config closer and playbookIndex opener",
			validFrontmatter +
			`${orientationSection}\n\n${configSection}\n\nScratch text between config and playbookIndex.\n\n${playbookIndexSection}\n\n${studyPlaybookSection}\n\n${updatePlaybookSection}\n\n${researchIndexSection}\n`,
		],
		[
			"scratch text between playbookIndex closer and studyPlaybook opener",
			validFrontmatter +
			`${orientationSection}\n\n${configSection}\n\n${playbookIndexSection}\n\nScratch text between playbookIndex and studyPlaybook.\n\n${studyPlaybookSection}\n\n${updatePlaybookSection}\n\n${researchIndexSection}\n`,
		],
		[
			"scratch text between studyPlaybook closer and updatePlaybook opener",
			validFrontmatter +
			`${orientationSection}\n\n${configSection}\n\n${playbookIndexSection}\n\n${studyPlaybookSection}\n\nScratch text between studyPlaybook and updatePlaybook.\n\n${updatePlaybookSection}\n\n${researchIndexSection}\n`,
		],
		[
			"scratch text between updatePlaybook closer and researchIndex opener",
			validFrontmatter +
			`${orientationSection}\n\n${configSection}\n\n${playbookIndexSection}\n\n${studyPlaybookSection}\n\n${updatePlaybookSection}\n\nScratch text between updatePlaybook and researchIndex.\n\n${researchIndexSection}\n`,
		],
		[
			"trailing comment after the researchIndex closer",
			validFrontmatter +
			`${orientationSection}\n\n${configSection}\n\n${playbookIndexSection}\n\n${studyPlaybookSection}\n\n${updatePlaybookSection}\n\n${researchIndexSection}\n\nA trailing comment after all sections.\n`,
		],
		[
			"all seven gap positions populated simultaneously",
			validFrontmatter +
			`Before orientation.\n\n${orientationSection}\n\nBetween orientation and config.\n\n${configSection}\n\nBetween config and playbookIndex.\n\n${playbookIndexSection}\n\nBetween playbookIndex and studyPlaybook.\n\n${studyPlaybookSection}\n\nBetween studyPlaybook and updatePlaybook.\n\n${updatePlaybookSection}\n\nBetween updatePlaybook and researchIndex.\n\n${researchIndexSection}\n\nAfter researchIndex.\n`,
		],
		[
			"marker-shaped content outside pairs is treated as plain bytes",
			// `<!-- aide-misc -->` is between two recognized pairs. It contains "aide" so the
			// permissive scan would flag it — BUT the parser's contract is that bytes outside
			// recognized pair regions are not policed. This tests that <!-- aide-misc --> between
			// pairs does NOT cause malformed-body.
			// (Note: if the implementation scans the whole body for malformed markers without
			// respecting pair boundaries, this test will catch the regression.)
			validFrontmatter +
			`${orientationSection}\n\n<!-- aide-misc -->\n\n${configSection}\n\n${playbookIndexSection}\n\n${studyPlaybookSection}\n\n${updatePlaybookSection}\n\n${researchIndexSection}\n`,
		],
	];

	it.each(outsideCases)("%s → ok (outside bytes silently ignored)", async (_description, content) => {
		await writeBrainAide(tempDir, content);

		const result = await parseBrainAide(tempDir);

		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return;

		// Each section contains only its own bytes — none of the outside text leaks in.
		expect(result.orientation).toBe("\nSome orientation.\n");
		expect(result.config).toBe("\nSome config.\n");
		expect(result.playbookIndex).toBe("\nSome playbook index.\n");
		expect(result.studyPlaybook).toBe("\nSome study playbook.\n");
		expect(result.updatePlaybook).toBe("\nSome update playbook.\n");
		expect(result.researchIndex).toBe("\nSome research index.\n");
	});
});

// ---------------------------------------------------------------------------
// 3k. Verbatim invariant extends to all six body sections (no substitution).
// Six sub-tests, one per section: orientation, config, playbookIndex,
// studyPlaybook, updatePlaybook, researchIndex.
// ---------------------------------------------------------------------------

describe("3k — all body sections returned verbatim (no-substitution invariant)", () => {
	it("orientation containing literal ${name} and ${rootPath} passes through byte-identical", async () => {
		const literalOrientationBody = `This is an orientation body with a literal \${name} placeholder.

It also has **markdown** and a [link](https://example.com).

The \${rootPath} value is also here for good measure.
`;
		const content =
			`---\nname: my-brain\nmcpServerConfig:\n  command: npx\n  args:\n    - "@example/mcp-launcher"\n    - "D:/brains/my-brain"\n---\n\n` +
			`<!-- aide-orientation-start -->\n${literalOrientationBody}<!-- aide-orientation-end -->\n\n` +
			`<!-- aide-config-start -->\nSome config content.\n<!-- aide-config-end -->\n\n` +
			`<!-- aide-playbook-index-start -->\nSome playbook index content.\n<!-- aide-playbook-index-end -->\n\n` +
			`<!-- aide-study-playbook-start -->\nSome study playbook content.\n<!-- aide-study-playbook-end -->\n\n` +
			`<!-- aide-update-playbook-start -->\nSome update playbook content.\n<!-- aide-update-playbook-end -->\n\n` +
			`<!-- aide-research-index-start -->\nSome research index content.\n<!-- aide-research-index-end -->\n`;

		await writeBrainAide(tempDir, content);

		const result = await parseBrainAide(tempDir);

		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return;
		// The orientation must contain the literal ${name} unchanged — no substitution.
		expect(result.orientation).toContain("${name}");
		// ${rootPath} in orientation is body text, not a deprecated frontmatter field — passes through.
		expect(result.orientation).toContain("${rootPath}");
		expect(result.orientation).toContain("**markdown**");
		// Full byte-identity: slice starts at opener.index + opener.length.
		expect(result.orientation).toBe(`\n${literalOrientationBody}`);
	});

	it("config containing literal ${name} passes through byte-identical", async () => {
		const configBody = `This config section contains \${name} literally.

The \${name} placeholder should not be substituted here.
`;
		const content =
			`---\nname: my-brain\nmcpServerConfig:\n  command: npx\n  args:\n    - "@example/mcp-launcher"\n    - "D:/brains/my-brain"\n---\n\n` +
			`<!-- aide-orientation-start -->\nSome orientation.\n<!-- aide-orientation-end -->\n\n` +
			`<!-- aide-config-start -->\n${configBody}<!-- aide-config-end -->\n\n` +
			`<!-- aide-playbook-index-start -->\nSome playbook index content.\n<!-- aide-playbook-index-end -->\n\n` +
			`<!-- aide-study-playbook-start -->\nSome study playbook content.\n<!-- aide-study-playbook-end -->\n\n` +
			`<!-- aide-update-playbook-start -->\nSome update playbook content.\n<!-- aide-update-playbook-end -->\n\n` +
			`<!-- aide-research-index-start -->\nSome research index content.\n<!-- aide-research-index-end -->\n`;

		await writeBrainAide(tempDir, content);

		const result = await parseBrainAide(tempDir);

		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return;
		// The config must contain the literal ${name} unchanged.
		expect(result.config).toContain("${name}");
		// Substitution only runs on mcpServerConfig.args — not on any body section.
		expect(result.config).not.toContain("my-brain");
	});

	it("playbookIndex containing literal ${name} passes through byte-identical", async () => {
		const playbookIndexBody = `This playbook index section contains \${name} literally.

The \${name} placeholder should not be substituted here.
`;
		const content =
			`---\nname: my-brain\nmcpServerConfig:\n  command: npx\n  args:\n    - "@example/mcp-launcher"\n    - "D:/brains/my-brain"\n---\n\n` +
			`<!-- aide-orientation-start -->\nSome orientation.\n<!-- aide-orientation-end -->\n\n` +
			`<!-- aide-config-start -->\nSome config.\n<!-- aide-config-end -->\n\n` +
			`<!-- aide-playbook-index-start -->\n${playbookIndexBody}<!-- aide-playbook-index-end -->\n\n` +
			`<!-- aide-study-playbook-start -->\nSome study playbook content.\n<!-- aide-study-playbook-end -->\n\n` +
			`<!-- aide-update-playbook-start -->\nSome update playbook content.\n<!-- aide-update-playbook-end -->\n\n` +
			`<!-- aide-research-index-start -->\nSome research index content.\n<!-- aide-research-index-end -->\n`;

		await writeBrainAide(tempDir, content);

		const result = await parseBrainAide(tempDir);

		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return;
		// The playbookIndex must contain the literal ${name} unchanged.
		expect(result.playbookIndex).toContain("${name}");
		// Substitution only runs on mcpServerConfig.args — not on any body section.
		expect(result.playbookIndex).not.toContain("my-brain");
	});

	it("studyPlaybook containing literal ${name} passes through byte-identical", async () => {
		const studyPlaybookBody = `This study playbook section contains \${name} literally.

The \${name} placeholder should not be substituted here.

The \${rootPath} value is also here for good measure.
`;
		const content =
			`---\nname: my-brain\nmcpServerConfig:\n  command: npx\n  args:\n    - "@example/mcp-launcher"\n    - "D:/brains/my-brain"\n---\n\n` +
			`<!-- aide-orientation-start -->\nSome orientation.\n<!-- aide-orientation-end -->\n\n` +
			`<!-- aide-config-start -->\nSome config.\n<!-- aide-config-end -->\n\n` +
			`<!-- aide-playbook-index-start -->\nSome playbook index.\n<!-- aide-playbook-index-end -->\n\n` +
			`<!-- aide-study-playbook-start -->\n${studyPlaybookBody}<!-- aide-study-playbook-end -->\n\n` +
			`<!-- aide-update-playbook-start -->\nSome update playbook content.\n<!-- aide-update-playbook-end -->\n\n` +
			`<!-- aide-research-index-start -->\nSome research index.\n<!-- aide-research-index-end -->\n`;

		await writeBrainAide(tempDir, content);

		const result = await parseBrainAide(tempDir);

		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return;
		// The studyPlaybook must contain the literal ${name} unchanged — no substitution.
		expect(result.studyPlaybook).toContain("${name}");
		// Substitution only runs on mcpServerConfig.args — not on any body section.
		expect(result.studyPlaybook).not.toContain("my-brain");
		// Full byte-identity.
		expect(result.studyPlaybook).toBe(`\n${studyPlaybookBody}`);
	});

	it("updatePlaybook containing literal ${name} passes through byte-identical", async () => {
		const updatePlaybookBody = `This update playbook section contains \${name} literally.

The \${name} placeholder should not be substituted here.
`;
		const content =
			`---\nname: my-brain\nmcpServerConfig:\n  command: npx\n  args:\n    - "@example/mcp-launcher"\n    - "D:/brains/my-brain"\n---\n\n` +
			`<!-- aide-orientation-start -->\nSome orientation.\n<!-- aide-orientation-end -->\n\n` +
			`<!-- aide-config-start -->\nSome config.\n<!-- aide-config-end -->\n\n` +
			`<!-- aide-playbook-index-start -->\nSome playbook index.\n<!-- aide-playbook-index-end -->\n\n` +
			`<!-- aide-study-playbook-start -->\nSome study playbook.\n<!-- aide-study-playbook-end -->\n\n` +
			`<!-- aide-update-playbook-start -->\n${updatePlaybookBody}<!-- aide-update-playbook-end -->\n\n` +
			`<!-- aide-research-index-start -->\nSome research index.\n<!-- aide-research-index-end -->\n`;

		await writeBrainAide(tempDir, content);

		const result = await parseBrainAide(tempDir);

		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return;
		// The updatePlaybook must contain the literal ${name} unchanged.
		expect(result.updatePlaybook).toContain("${name}");
		// Substitution only runs on mcpServerConfig.args — not on any body section.
		expect(result.updatePlaybook).not.toContain("my-brain");
	});

	it("researchIndex containing literal ${name} passes through byte-identical", async () => {
		const researchIndexBody = `This research index section contains \${name} literally.

The \${name} placeholder should not be substituted here either.
`;
		const content =
			`---\nname: my-brain\nmcpServerConfig:\n  command: npx\n  args:\n    - "@example/mcp-launcher"\n    - "D:/brains/my-brain"\n---\n\n` +
			`<!-- aide-orientation-start -->\nSome orientation.\n<!-- aide-orientation-end -->\n\n` +
			`<!-- aide-config-start -->\nSome config.\n<!-- aide-config-end -->\n\n` +
			`<!-- aide-playbook-index-start -->\nSome playbook index.\n<!-- aide-playbook-index-end -->\n\n` +
			`<!-- aide-study-playbook-start -->\nSome study playbook.\n<!-- aide-study-playbook-end -->\n\n` +
			`<!-- aide-update-playbook-start -->\nSome update playbook.\n<!-- aide-update-playbook-end -->\n\n` +
			`<!-- aide-research-index-start -->\n${researchIndexBody}<!-- aide-research-index-end -->\n`;

		await writeBrainAide(tempDir, content);

		const result = await parseBrainAide(tempDir);

		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return;
		// The researchIndex must contain the literal ${name} unchanged.
		expect(result.researchIndex).toContain("${name}");
		// Substitution only runs on mcpServerConfig.args — not on any body section.
		expect(result.researchIndex).not.toContain("my-brain");
	});
});

// ---------------------------------------------------------------------------
// 3l. Name is metadata, not dispatched on — fixtures rebuilt with six marker pairs.
// ---------------------------------------------------------------------------

describe("3l — name is metadata, not dispatched on", () => {
	function makeContentWithName(name: string): string {
		return (
			`---\nname: ${name}\nmcpServerConfig:\n  command: npx\n  args:\n    - "@example/mcp-launcher"\n    - "D:/brains/my-brain"\n---\n\n` +
			`<!-- aide-orientation-start -->\nOrientation body for ${name} brain.\n<!-- aide-orientation-end -->\n\n` +
			`<!-- aide-config-start -->\nConfig body for ${name} brain.\n<!-- aide-config-end -->\n\n` +
			`<!-- aide-playbook-index-start -->\nPlaybook index body for ${name} brain.\n<!-- aide-playbook-index-end -->\n\n` +
			`<!-- aide-study-playbook-start -->\nStudy playbook body for ${name} brain.\n<!-- aide-study-playbook-end -->\n\n` +
			`<!-- aide-update-playbook-start -->\nUpdate playbook body for ${name} brain.\n<!-- aide-update-playbook-end -->\n\n` +
			`<!-- aide-research-index-start -->\nResearch index body for ${name} brain.\n<!-- aide-research-index-end -->\n`
		);
	}

	it("different name values both parse identically — result.kind is ok for both", async () => {
		const brainADir = await mkdtemp(join(tmpdir(), "aide-name-brain-a-"));
		const brainBDir = await mkdtemp(join(tmpdir(), "aide-name-brain-b-"));

		try {
			await writeBrainAide(brainADir, makeContentWithName("brain-a"));
			await writeBrainAide(brainBDir, makeContentWithName("brain-b"));

			const resultA = await parseBrainAide(brainADir);
			const resultB = await parseBrainAide(brainBDir);

			expect(resultA.kind).toBe("ok");
			expect(resultB.kind).toBe("ok");

			if (resultA.kind !== "ok" || resultB.kind !== "ok") return;

			// Both have the same shape — only name value and body content differ.
			expect(resultA.name).toBe("brain-a");
			expect(resultB.name).toBe("brain-b");

			// mcpServerConfig is identical — name did not influence it.
			expect(resultA.mcpServerConfig).toEqual(resultB.mcpServerConfig);

			// Both orientation bodies pass through verbatim (no name-based rewriting).
			// The slice starts immediately after the orientation opener byte sequence,
			// so the leading \n (newline after the opener) is included verbatim.
			expect(resultA.orientation).toBe("\nOrientation body for brain-a brain.\n");
			expect(resultB.orientation).toBe("\nOrientation body for brain-b brain.\n");
		} finally {
			await rm(brainADir, { recursive: true, force: true });
			await rm(brainBDir, { recursive: true, force: true });
		}
	});
});

// ---------------------------------------------------------------------------
// 3m. interpolateArgs — canonical config is a no-op (structurally unchanged)
// ---------------------------------------------------------------------------

describe("3m — interpolateArgs canonical config is a no-op", () => {
	it("canonical args have no placeholders — return is structurally equal to input args", () => {
		const result = interpolateArgs(CANONICAL_CONFIG);

		expect(result).toEqual(["@example/mcp-launcher", "D:/brains/my-brain"]);
	});

	it("does not mutate the original config.mcpServerConfig.args", () => {
		const originalArgs = [...CANONICAL_CONFIG.mcpServerConfig.args];

		interpolateArgs(CANONICAL_CONFIG);

		expect(CANONICAL_CONFIG.mcpServerConfig.args).toEqual(originalArgs);
	});

	it("advanced-user case: ${name} in args is substituted with config.name", () => {
		const config: BrainAideConfig = {
			name: "my-brain",
			mcpServerConfig: {
				command: "some-launcher",
				args: ["some-launcher", "--profile", "${name}"],
			},
		};

		const result = interpolateArgs(config);

		expect(result).toEqual(["some-launcher", "--profile", "my-brain"]);
	});
});

// ---------------------------------------------------------------------------
// 3m'. interpolateArgs is positional (string replacement, not arg replacement)
// ---------------------------------------------------------------------------

describe("3m' — interpolateArgs is positional", () => {
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
// 3m''. interpolateArgs does not touch any body section
// ---------------------------------------------------------------------------

describe("3m'' — interpolateArgs does not touch the body sections", () => {
	it("interpolateArgs takes only config — it has no path that receives any body section", async () => {
		await writeBrainAide(tempDir, CANONICAL_BRAIN_AIDE);
		const parseResult = await parseBrainAide(tempDir);

		expect(parseResult.kind).toBe("ok");
		if (parseResult.kind !== "ok") return;

		const orientationBeforeInterpolation = parseResult.orientation;
		const configBeforeInterpolation = parseResult.config;
		const playbookIndexBeforeInterpolation = parseResult.playbookIndex;
		const studyPlaybookBeforeInterpolation = parseResult.studyPlaybook;
		const updatePlaybookBeforeInterpolation = parseResult.updatePlaybook;
		const researchIndexBeforeInterpolation = parseResult.researchIndex;

		// interpolateArgs only accepts a BrainAideConfig — body sections are structurally
		// excluded from its signature. Pass the frontmatter fields directly.
		const interpolated = interpolateArgs({
			name: parseResult.name,
			mcpServerConfig: parseResult.mcpServerConfig,
		});

		// Calling interpolateArgs did not affect any body string.
		expect(parseResult.orientation).toBe(orientationBeforeInterpolation);
		expect(parseResult.config).toBe(configBeforeInterpolation);
		expect(parseResult.playbookIndex).toBe(playbookIndexBeforeInterpolation);
		expect(parseResult.studyPlaybook).toBe(studyPlaybookBeforeInterpolation);
		expect(parseResult.updatePlaybook).toBe(updatePlaybookBeforeInterpolation);
		expect(parseResult.researchIndex).toBe(researchIndexBeforeInterpolation);
		// The interpolated result is the args array — no body strings in the return value.
		expect(Array.isArray(interpolated)).toBe(true);
		expect(interpolated).not.toContain(orientationBeforeInterpolation);
	});
});

// ---------------------------------------------------------------------------
// 3n. parseBrainAideFromString parity tests.
// Fixtures rebuilt with six marker pairs; noPlaybookIndexContent updated to
// include all six pairs except the one being tested. The malformed-body parity
// sub-test asserts that disk and string paths produce the same reason for a
// missing pair.
// ---------------------------------------------------------------------------

describe("3n — parseBrainAideFromString parses bytes identically to parseBrainAide from disk", () => {
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

<!-- aide-orientation-start -->
Orientation.
<!-- aide-orientation-end -->

<!-- aide-config-start -->
Config.
<!-- aide-config-end -->

<!-- aide-playbook-index-start -->
Playbook index.
<!-- aide-playbook-index-end -->

<!-- aide-study-playbook-start -->
Study playbook.
<!-- aide-study-playbook-end -->

<!-- aide-update-playbook-start -->
Update playbook.
<!-- aide-update-playbook-end -->

<!-- aide-research-index-start -->
Research index.
<!-- aide-research-index-end -->
`;
		await writeBrainAide(tempDir, badYaml);

		const fromDisk = await parseBrainAide(tempDir);
		const fromString = parseBrainAideFromString(badYaml);

		expect(fromDisk.kind).toBe("malformed-frontmatter");
		expect(fromString.kind).toBe("malformed-frontmatter");
		expect(fromDisk).toEqual(fromString);
	});

	it("malformed-body — missing playbookIndex pair parses identically via both paths", async () => {
		// Body has orientation, config, studyPlaybook, updatePlaybook, and researchIndex
		// marker pairs but is missing the playbookIndex pair — both disk and string paths
		// must return the same malformed-body reason.
		const noPlaybookIndexContent = `---
name: my-brain
mcpServerConfig:
  command: npx
  args:
    - "@example/mcp-launcher"
    - "D:/brains/my-brain"
---

<!-- aide-orientation-start -->
Some orientation.
<!-- aide-orientation-end -->

<!-- aide-config-start -->
Some config.
<!-- aide-config-end -->

<!-- aide-study-playbook-start -->
Some study playbook.
<!-- aide-study-playbook-end -->

<!-- aide-update-playbook-start -->
Some update playbook.
<!-- aide-update-playbook-end -->

<!-- aide-research-index-start -->
Some research index.
<!-- aide-research-index-end -->
`;
		await writeBrainAide(tempDir, noPlaybookIndexContent);

		const fromDisk = await parseBrainAide(tempDir);
		const fromString = parseBrainAideFromString(noPlaybookIndexContent);

		expect(fromDisk.kind).toBe("malformed-body");
		expect(fromString.kind).toBe("malformed-body");
		if (fromDisk.kind !== "malformed-body" || fromString.kind !== "malformed-body") return;
		// Both paths return the same reason naming the missing pair.
		expect(fromDisk.reason).toBe(
			"missing markers: <!-- aide-playbook-index-start -->, <!-- aide-playbook-index-end -->",
		);
		expect(fromDisk).toEqual(fromString);
	});

	it("malformed-body — missing studyPlaybook pair parses identically via both paths", async () => {
		// Mirror the noPlaybookIndexContent fixture: body has orientation, config,
		// playbookIndex, updatePlaybook, and researchIndex marker pairs but is missing
		// the study-playbook pair. Both disk and string paths must return the same
		// malformed-body reason naming the missing study-playbook markers specifically.
		const noStudyPlaybookContent = `---
name: my-brain
mcpServerConfig:
  command: npx
  args:
    - "@example/mcp-launcher"
    - "D:/brains/my-brain"
---

<!-- aide-orientation-start -->
Some orientation.
<!-- aide-orientation-end -->

<!-- aide-config-start -->
Some config.
<!-- aide-config-end -->

<!-- aide-playbook-index-start -->
Some playbook index.
<!-- aide-playbook-index-end -->

<!-- aide-update-playbook-start -->
Some update playbook.
<!-- aide-update-playbook-end -->

<!-- aide-research-index-start -->
Some research index.
<!-- aide-research-index-end -->
`;
		await writeBrainAide(tempDir, noStudyPlaybookContent);

		const fromDisk = await parseBrainAide(tempDir);
		const fromString = parseBrainAideFromString(noStudyPlaybookContent);

		expect(fromDisk.kind).toBe("malformed-body");
		expect(fromString.kind).toBe("malformed-body");
		if (fromDisk.kind !== "malformed-body" || fromString.kind !== "malformed-body") return;
		// Both paths return the same reason naming the missing pair.
		expect(fromDisk.reason).toBe(
			"missing markers: <!-- aide-study-playbook-start -->, <!-- aide-study-playbook-end -->",
		);
		expect(fromString.reason).toBe(
			"missing markers: <!-- aide-study-playbook-start -->, <!-- aide-study-playbook-end -->",
		);
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

// ---------------------------------------------------------------------------
// 3o. Per-section ownership: result no longer has a config wrapper.
//
// Asserts the flattened-frontmatter shape: on the ok variant, name, mcpServerConfig,
// and all six body sections are siblings at the top level. The body section literally
// named `config` is a string, not the parsed BrainAideConfig object. There is no
// result.config.name / result.config.mcpServerConfig nesting any more.
// ---------------------------------------------------------------------------

describe("3o — per-section ownership: all fields are top-level siblings on the flattened ok variant", () => {
	it("result.name, result.mcpServerConfig, and all six body sections are top-level siblings; result.config is a string", async () => {
		await writeBrainAide(tempDir, CANONICAL_BRAIN_AIDE);

		const result = await parseBrainAide(tempDir);

		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return;

		// Frontmatter fields are flattened directly onto the ok result.
		expect(typeof result.name).toBe("string");
		expect(typeof result.mcpServerConfig).toBe("object");
		expect(typeof result.mcpServerConfig.command).toBe("string");
		expect(Array.isArray(result.mcpServerConfig.args)).toBe(true);

		// Body section fields are string siblings of the frontmatter fields.
		expect(typeof result.orientation).toBe("string");
		expect(typeof result.playbookIndex).toBe("string");
		expect(typeof result.studyPlaybook).toBe("string");
		expect(typeof result.updatePlaybook).toBe("string");
		expect(typeof result.researchIndex).toBe("string");

		// The body section literally named `config` is a STRING — not the parsed
		// BrainAideConfig object. This locks in the spec's invariant: the body field
		// named `config` (the integration's wiring-flow prose) sits as a peer of the
		// frontmatter fields rather than nested under any `config` wrapper.
		expect(typeof result.config).toBe("string");

		// Verify the body sections are non-empty and contain expected content.
		expect(result.orientation.length).toBeGreaterThan(0);
		expect(result.config.length).toBeGreaterThan(0);
		expect(result.playbookIndex.length).toBeGreaterThan(0);
		expect(result.studyPlaybook.length).toBeGreaterThan(0);
		expect(result.updatePlaybook.length).toBeGreaterThan(0);
		expect(result.researchIndex.length).toBeGreaterThan(0);
	});
});

// ---------------------------------------------------------------------------
// 4a. Happy-path verbatim-slicing invariant for the two new sections.
//
// Extends the 3a happy-path assertions by confirming that result.config (string)
// and result.updatePlaybook (string) are byte-identical to the canonical section
// extracted from the fixture by extractCanonicalSection. Confirms the two new
// sections participate in the verbatim-slicing invariant on equal footing with
// the four pre-existing ones.
// ---------------------------------------------------------------------------

describe("4a — new sections participate in the verbatim-slicing invariant", () => {
	it("result.config is byte-identical to extractCanonicalSection(\"config\")", async () => {
		await writeBrainAide(tempDir, CANONICAL_BRAIN_AIDE);

		const result = await parseBrainAide(tempDir);

		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return;

		// Byte-identical to the verbatim slice from the canonical fixture.
		expect(result.config).toBe(extractCanonicalSection("config"));
	});

	it("result.updatePlaybook is byte-identical to extractCanonicalSection(\"updatePlaybook\")", async () => {
		await writeBrainAide(tempDir, CANONICAL_BRAIN_AIDE);

		const result = await parseBrainAide(tempDir);

		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return;

		// Byte-identical to the verbatim slice from the canonical fixture.
		expect(result.updatePlaybook).toBe(extractCanonicalSection("updatePlaybook"));
	});
});

// ---------------------------------------------------------------------------
// 4d. Marker-order violation: playbookIndex opener appears before config opener.
//
// The config section is required at position 2 (between orientation and
// playbookIndex). A fixture that writes playbookIndex third (after orientation)
// and config second-but-placed-third returns malformed-body naming the violation.
// ---------------------------------------------------------------------------

describe("4d — marker order violation: playbookIndex before config", () => {
	it("playbookIndex opener appearing before config opener → malformed-body naming the violation", async () => {
		const validFrontmatter =
			`---\nname: my-brain\nmcpServerConfig:\n  command: npx\n  args:\n    - "@example/mcp-launcher"\n    - "D:/brains/my-brain"\n---\n\n`;

		// The user wrote orientation → playbookIndex → config → studyPlaybook → updatePlaybook → researchIndex.
		// config is required at position 2; playbookIndex appeared first (position 2 slot),
		// so the order check fires: playbookIndex-start appeared before config-start.
		const content =
			validFrontmatter +
			`<!-- aide-orientation-start -->\nSome orientation.\n<!-- aide-orientation-end -->\n\n` +
			`<!-- aide-playbook-index-start -->\nSome playbook index.\n<!-- aide-playbook-index-end -->\n\n` +
			`<!-- aide-config-start -->\nSome config.\n<!-- aide-config-end -->\n\n` +
			`<!-- aide-study-playbook-start -->\nSome study playbook.\n<!-- aide-study-playbook-end -->\n\n` +
			`<!-- aide-update-playbook-start -->\nSome update playbook.\n<!-- aide-update-playbook-end -->\n\n` +
			`<!-- aide-research-index-start -->\nSome research index.\n<!-- aide-research-index-end -->\n`;

		await writeBrainAide(tempDir, content);

		const result = await parseBrainAide(tempDir);

		expect(result.kind).toBe("malformed-body");
		if (result.kind !== "malformed-body") return;
		expect(result.reason).toBe(
			"marker order violation: <!-- aide-playbook-index-start --> appeared before <!-- aide-config-start -->",
		);
	});
});

// ---------------------------------------------------------------------------
// 4g. Malformed-marker cases for the new section markers.
//
// At least one case per new section marker (config-start, config-end,
// update-playbook-start, update-playbook-end). Each fixture has valid
// frontmatter and a body where one new-section marker is replaced by a
// malformed variant; the other eleven recognized markers are correctly
// present and paired. Each case asserts kind === "malformed-body" and
// reason starting with "unknown marker: " plus the offending byte sequence.
// ---------------------------------------------------------------------------

describe("4g — malformed/typo'd new-section marker rejection", () => {
	const validFrontmatter =
		`---\nname: my-brain\nmcpServerConfig:\n  command: npx\n  args:\n    - "@example/mcp-launcher"\n    - "D:/brains/my-brain"\n---\n\n`;

	/**
	 * Build a body where the config opener is replaced by the given malformed marker.
	 * All other eleven recognized markers are correctly present and paired.
	 */
	function bodyWithMalformedConfigOpener(malformedMarker: string): string {
		return (
			`<!-- aide-orientation-start -->\nSome orientation.\n<!-- aide-orientation-end -->\n\n` +
			`${malformedMarker}\nSome config.\n<!-- aide-config-end -->\n\n` +
			`<!-- aide-playbook-index-start -->\nSome playbook index.\n<!-- aide-playbook-index-end -->\n\n` +
			`<!-- aide-study-playbook-start -->\nSome study playbook.\n<!-- aide-study-playbook-end -->\n\n` +
			`<!-- aide-update-playbook-start -->\nSome update playbook.\n<!-- aide-update-playbook-end -->\n\n` +
			`<!-- aide-research-index-start -->\nSome research index.\n<!-- aide-research-index-end -->\n`
		);
	}

	/**
	 * Build a body where the config closer is replaced by the given malformed marker.
	 * All other eleven recognized markers are correctly present and paired.
	 */
	function bodyWithMalformedConfigCloser(malformedMarker: string): string {
		return (
			`<!-- aide-orientation-start -->\nSome orientation.\n<!-- aide-orientation-end -->\n\n` +
			`<!-- aide-config-start -->\nSome config.\n${malformedMarker}\n\n` +
			`<!-- aide-playbook-index-start -->\nSome playbook index.\n<!-- aide-playbook-index-end -->\n\n` +
			`<!-- aide-study-playbook-start -->\nSome study playbook.\n<!-- aide-study-playbook-end -->\n\n` +
			`<!-- aide-update-playbook-start -->\nSome update playbook.\n<!-- aide-update-playbook-end -->\n\n` +
			`<!-- aide-research-index-start -->\nSome research index.\n<!-- aide-research-index-end -->\n`
		);
	}

	/**
	 * Build a body where the update-playbook opener is replaced by the given malformed marker.
	 * All other eleven recognized markers are correctly present and paired.
	 */
	function bodyWithMalformedUpdatePlaybookOpener(malformedMarker: string): string {
		return (
			`<!-- aide-orientation-start -->\nSome orientation.\n<!-- aide-orientation-end -->\n\n` +
			`<!-- aide-config-start -->\nSome config.\n<!-- aide-config-end -->\n\n` +
			`<!-- aide-playbook-index-start -->\nSome playbook index.\n<!-- aide-playbook-index-end -->\n\n` +
			`<!-- aide-study-playbook-start -->\nSome study playbook.\n<!-- aide-study-playbook-end -->\n\n` +
			`${malformedMarker}\nSome update playbook.\n<!-- aide-update-playbook-end -->\n\n` +
			`<!-- aide-research-index-start -->\nSome research index.\n<!-- aide-research-index-end -->\n`
		);
	}

	/**
	 * Build a body where the update-playbook closer is replaced by the given malformed marker.
	 * All other eleven recognized markers are correctly present and paired.
	 */
	function bodyWithMalformedUpdatePlaybookCloser(malformedMarker: string): string {
		return (
			`<!-- aide-orientation-start -->\nSome orientation.\n<!-- aide-orientation-end -->\n\n` +
			`<!-- aide-config-start -->\nSome config.\n<!-- aide-config-end -->\n\n` +
			`<!-- aide-playbook-index-start -->\nSome playbook index.\n<!-- aide-playbook-index-end -->\n\n` +
			`<!-- aide-study-playbook-start -->\nSome study playbook.\n<!-- aide-study-playbook-end -->\n\n` +
			`<!-- aide-update-playbook-start -->\nSome update playbook.\n${malformedMarker}\n\n` +
			`<!-- aide-research-index-start -->\nSome research index.\n<!-- aide-research-index-end -->\n`
		);
	}

	const newSectionMalformedCases: Array<[string, string, string]> = [
		[
			"uppercase config-start: <!-- AIDE-CONFIG-START -->",
			bodyWithMalformedConfigOpener("<!-- AIDE-CONFIG-START -->"),
			"unknown marker: <!-- AIDE-CONFIG-START -->",
		],
		[
			"typo in config-end: <!-- aide-config-ennd -->",
			bodyWithMalformedConfigCloser("<!-- aide-config-ennd -->"),
			"unknown marker: <!-- aide-config-ennd -->",
		],
		[
			"typo in update-playbook-start: <!-- aide-update-playbook-strart -->",
			bodyWithMalformedUpdatePlaybookOpener("<!-- aide-update-playbook-strart -->"),
			"unknown marker: <!-- aide-update-playbook-strart -->",
		],
		[
			"uppercase update-playbook-end: <!-- AIDE-UPDATE-PLAYBOOK-END -->",
			bodyWithMalformedUpdatePlaybookCloser("<!-- AIDE-UPDATE-PLAYBOOK-END -->"),
			"unknown marker: <!-- AIDE-UPDATE-PLAYBOOK-END -->",
		],
	];

	it.each(newSectionMalformedCases)("%s → malformed-body with unknown marker reason", async (_description, body, expectedReason) => {
		const content = validFrontmatter + body;
		await writeBrainAide(tempDir, content);

		const result = await parseBrainAide(tempDir);

		expect(result.kind).toBe("malformed-body");
		if (result.kind !== "malformed-body") return;
		expect(result.reason).toBe(expectedReason);
	});
});

// ---------------------------------------------------------------------------
// 4h. Strict-failure migration: four-pair pre-rework body.
//
// A brain.aide carrying the four pre-rework marker pairs in their correct relative
// order — aide-prose-*, aide-playbook-*, aide-study-playbook-*, aide-research-* —
// returns malformed-body listing every new marker that is missing or retired-named.
//
// The retired marker tokens (aide-prose-*, aide-playbook-* without -index, and
// aide-research-* without -index) are NOT in the candidate regex alternation after
// the Step 2d update, so they fall through to the missing-markers check along with
// the brand-new aide-config-* and aide-update-playbook-* pairs. The studyPlaybook
// pair carries through unchanged, so its markers are NOT listed as missing.
//
// Expected reason lists ten markers in fixed scan order (five pairs × two tokens):
//   orientation-start, orientation-end, config-start, config-end,
//   playbook-index-start, playbook-index-end,
//   update-playbook-start, update-playbook-end,
//   research-index-start, research-index-end.
// ---------------------------------------------------------------------------

describe("4h — strict-failure migration: four-pair pre-rework body", () => {
	it("four-pair pre-rework body (prose + playbook + studyPlaybook + research, using retired marker names) returns malformed-body listing the ten new/renamed markers as missing", async () => {
		const validFrontmatter =
			`---\nname: my-brain\nmcpServerConfig:\n  command: npx\n  args:\n    - "@example/mcp-launcher"\n    - "D:/brains/my-brain"\n---\n\n`;

		// The four pre-rework pairs in correct relative order.
		// aide-study-playbook-* carries through unchanged — it is the only pair the user
		// already has by the correct name and is therefore NOT listed as missing.
		// The retired aide-prose-*, aide-playbook-* (without -index), and aide-research-*
		// (without -index) tokens are no longer in the candidate regex alternations after
		// Step 2d, so they fall through to the missing-markers check.
		const fourPairBody =
			`<!-- aide-prose-start -->\nSome prose content.\n<!-- aide-prose-end -->\n\n` +
			`<!-- aide-playbook-start -->\nSome playbook content.\n<!-- aide-playbook-end -->\n\n` +
			`<!-- aide-study-playbook-start -->\nSome study playbook content.\n<!-- aide-study-playbook-end -->\n\n` +
			`<!-- aide-research-start -->\nSome research content.\n<!-- aide-research-end -->\n`;

		await writeBrainAide(tempDir, validFrontmatter + fourPairBody);

		const result = await parseBrainAide(tempDir);

		expect(result.kind).toBe("malformed-body");
		if (result.kind !== "malformed-body") return;
		// The reason lists every new/renamed marker the user must add, in fixed scan order.
		// studyPlaybook is NOT listed — the user already has that pair by the correct name.
		expect(result.reason).toBe(
			"missing markers: <!-- aide-orientation-start -->, <!-- aide-orientation-end -->, <!-- aide-config-start -->, <!-- aide-config-end -->, <!-- aide-playbook-index-start -->, <!-- aide-playbook-index-end -->, <!-- aide-update-playbook-start -->, <!-- aide-update-playbook-end -->, <!-- aide-research-index-start -->, <!-- aide-research-index-end -->",
		);
	});
});

// ---------------------------------------------------------------------------
// args type contract — string | null
//
// 3a–3d: parsing cases asserting null entries in mcpServerConfig.args are
// preserved verbatim at their original indexes.
// ---------------------------------------------------------------------------

describe("args type contract — string | null", () => {
	// 3a. Single null at the last position of the args list.
	// Maps to the spec's "A null-armed brain.aide... parses with a YAML null preserved
	// at the unwired index" Good example.
	it("single null at last args index is preserved verbatim — no compaction", async () => {
		const content = makeCanonicalContent({
			argsLines: [
				'    - "@example/mcp-launcher"',
				'    - "D:/brains/my-brain"',
				"    -",
			],
		});
		await writeBrainAide(tempDir, content);

		const result = await parseBrainAide(tempDir);

		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return;

		expect(result.mcpServerConfig.args.length).toBe(3);
		expect(result.mcpServerConfig.args[0]).toBe("@example/mcp-launcher");
		expect(result.mcpServerConfig.args[1]).toBe("D:/brains/my-brain");
		expect(result.mcpServerConfig.args[2]).toBeNull();
	});

	// 3b. Multiple nulls at non-adjacent indexes.
	// Locks in the structural-null invariant: multiple nulls at arbitrary indexes
	// preserve their indexes one-to-one with the source YAML.
	// Per the spec's "A parser that drops null entries from args or compacts the array"
	// undesired outcome.
	it("two nulls at non-adjacent indexes (positions 1 and 3 of a four-entry list) are both preserved", async () => {
		const content = makeCanonicalContent({
			argsLines: [
				'    - "launcher"',
				"    -",
				'    - "config"',
				"    -",
			],
		});
		await writeBrainAide(tempDir, content);

		const result = await parseBrainAide(tempDir);

		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return;

		expect(result.mcpServerConfig.args.length).toBe(4);
		expect(result.mcpServerConfig.args[0]).toBe("launcher");
		expect(result.mcpServerConfig.args[1]).toBeNull();
		expect(result.mcpServerConfig.args[2]).toBe("config");
		expect(result.mcpServerConfig.args[3]).toBeNull();
	});

	// 3c. All entries are YAML nulls.
	// The parser's contract is per-element: every element passes through verbatim,
	// regardless of mix. Strict equality per index pinpoints the offending index on failure.
	it("all-null args list — every element is JS null at its original index", async () => {
		const content = makeCanonicalContent({
			argsLines: [
				"    -",
				"    -",
				"    -",
			],
		});
		await writeBrainAide(tempDir, content);

		const result = await parseBrainAide(tempDir);

		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return;

		expect(result.mcpServerConfig.args.length).toBe(3);
		expect(result.mcpServerConfig.args[0]).toBeNull();
		expect(result.mcpServerConfig.args[1]).toBeNull();
		expect(result.mcpServerConfig.args[2]).toBeNull();
	});

	// 3d. Regression-prevention: null mixed with strings must NOT return malformed-frontmatter.
	// Null is part of the args contract, not a malformed value. This case is the regression
	// bumper for the spec's "A parser that rejects null entries in args as malformed-frontmatter"
	// undesired outcome.
	it("null entry mixed with strings returns ok — null is part of the args contract, not a malformed value", async () => {
		const content = makeCanonicalContent({
			argsLines: [
				'    - "@example/mcp-launcher"',
				"    -",
				'    - "D:/brains/my-brain"',
			],
		});
		await writeBrainAide(tempDir, content);

		const result = await parseBrainAide(tempDir);

		expect(result.kind).toBe("ok");
	});
});

// ---------------------------------------------------------------------------
// 4b — interpolateArgs null-passthrough
//
// 3e–3f: null entries in args pass through unchanged at their original index.
// ---------------------------------------------------------------------------

describe("4b — interpolateArgs null-passthrough", () => {
	// 3e. Null-passthrough happy path: no placeholders, null at index 1 passes through.
	// Maps to the spec's "interpolateArgs against a null-armed config preserves the null
	// at its index" Good example.
	it("null at index 1 passes through unchanged — strings without placeholders also pass through", () => {
		const config: BrainAideConfig = {
			name: "my-brain",
			mcpServerConfig: {
				command: "npx",
				args: ["a", null, "b"],
			},
		};

		const result = interpolateArgs(config);

		expect(result).toEqual(["a", null, "b"]);
		expect(result.length).toBe(3);
		expect(result[1]).toBeNull();
	});

	// 3f. Mixed substitution and null: ${name} is substituted, adjacent null passes through.
	// Maps to the spec's "An advanced user opts into interpolation by referencing ${name};
	// null entries continue to pass through" Good example.
	it("${name} at index 2 is substituted; null at index 3 passes through unchanged", () => {
		const config: BrainAideConfig = {
			name: "dev-brain",
			mcpServerConfig: {
				command: "npx",
				args: ["some-launcher", "--profile", "${name}", null],
			},
		};

		const result = interpolateArgs(config);

		expect(result).toEqual(["some-launcher", "--profile", "dev-brain", null]);
		expect(result[3]).toBeNull();
	});
});

// ---------------------------------------------------------------------------
// args type contract round-trip
//
// 3g. A YAML null at args index 3 survives the full parser → interpolateArgs pipeline
// at the same index. Proves the spec's "Null passthrough is mandatory and tested at
// every transformation the parser exposes" Strategy paragraph end-to-end.
// ---------------------------------------------------------------------------

describe("args type contract round-trip — null survives parser and interpolateArgs at the same index", () => {
	it("null at args index 3 in source YAML is null at index 3 after parse and after interpolateArgs", async () => {
		const content = makeCanonicalContent({
			argsLines: [
				'    - "@example/mcp-launcher"',
				'    - "--profile"',
				'    - "dev-brain"',
				"    -",
			],
		});
		await writeBrainAide(tempDir, content);

		const result = await parseBrainAide(tempDir);

		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return;

		expect(result.mcpServerConfig.args[3]).toBeNull();

		const interpolated = interpolateArgs({
			name: result.name,
			mcpServerConfig: result.mcpServerConfig,
		});

		expect(interpolated.length).toBe(4);
		expect(interpolated[3]).toBeNull();
	});
});

// ---------------------------------------------------------------------------
// 3h — parseBrainAideFromString null-armed parity
//
// Both the disk path (parseBrainAide) and the string path (parseBrainAideFromString)
// must agree on null-armed input. Extends the 3n parity family.
// ---------------------------------------------------------------------------

describe("3h — parseBrainAideFromString null-armed parity", () => {
	it("null-armed content string parses identically via disk and string paths — null index identical on both", async () => {
		const nullArmedContent = makeCanonicalContent({
			argsLines: [
				'    - "@example/mcp-launcher"',
				'    - "D:/brains/my-brain"',
				"    -",
			],
		});
		await writeBrainAide(tempDir, nullArmedContent);

		const fromDisk = await parseBrainAide(tempDir);
		const fromString = parseBrainAideFromString(nullArmedContent);

		expect(fromDisk).toEqual(fromString);
		expect(fromDisk.kind).toBe("ok");
		if (fromDisk.kind !== "ok" || fromString.kind !== "ok") return;

		expect(fromDisk.mcpServerConfig.args[2]).toBeNull();
		expect(fromString.mcpServerConfig.args[2]).toBeNull();
	});
});
