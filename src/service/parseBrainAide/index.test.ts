import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import parseBrainAide, { parseBrainAideFromString, interpolateArgs } from "./index.js";
import type { BrainAideConfig } from "@/types/index.js";

// ---------------------------------------------------------------------------
// 3a. Shared fixture: the canonical brain.aide with all four required sections.
//
// The fixture mirrors the spec's "Good examples" block. It exercises:
//   - All four required marker pairs in fixed order (prose, playbook,
//     studyPlaybook, research).
//   - A note-to-self ABOVE the first opener (between frontmatter and
//     <!-- aide-prose-start -->) so bytes-outside-pairs silent-ignore is
//     observed end-to-end on the happy path.
//   - Non-trivial multi-paragraph content inside each section, including
//     markdown features the parser must NOT interpret: literal `#` H1 headings,
//     `##` and `###` headings, and literal `${name}`-shaped placeholders.
//     These prove the marker walker matches only the eight exact byte sequences
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

<!-- aide-prose-start -->
Your brain is an external knowledge store reached through MCP tools.
Use \`mcp__brain__read_note\` to open files by their brain-root-relative
path. Use \`mcp__brain__search_notes\` for keyword queries across the
brain. The brain's entry file is \`CLAUDE.md\` at the brain root — read
that first; it lists the inline references your task may need.
<!-- aide-prose-end -->

<!-- aide-playbook-start -->
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
<!-- aide-playbook-end -->

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

<!-- aide-research-start -->
# Research

An entry point for domain research material. Each subdirectory holds
material for a single domain; read the domain entry point before
drilling into individual files.

## Domains

(Add domain entry points here as your research grows.)

### Example domain

A \${name} placeholder here proves verbatim pass-through in the
research section.
<!-- aide-research-end -->
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

const MARKER_OPENERS: Record<"prose" | "playbook" | "studyPlaybook" | "research", string> = {
	prose: "<!-- aide-prose-start -->",
	playbook: "<!-- aide-playbook-start -->",
	studyPlaybook: "<!-- aide-study-playbook-start -->",
	research: "<!-- aide-research-start -->",
};
const MARKER_CLOSERS: Record<"prose" | "playbook" | "studyPlaybook" | "research", string> = {
	prose: "<!-- aide-prose-end -->",
	playbook: "<!-- aide-playbook-end -->",
	studyPlaybook: "<!-- aide-study-playbook-end -->",
	research: "<!-- aide-research-end -->",
};

function extractCanonicalSection(name: "prose" | "playbook" | "studyPlaybook" | "research"): string {
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
 * Build a minimal valid four-section brain.aide content string using
 * the marker-pair body grammar. All four required marker pairs are present
 * in the correct prose-then-playbook-then-studyPlaybook-then-research order.
 */
function makeCanonicalContent(overrides?: {
	name?: string;
	extraFrontmatterLines?: string[];
	proseBody?: string;
	playbookBody?: string;
	studyPlaybookBody?: string;
	researchBody?: string;
}): string {
	const name = overrides?.name ?? "my-brain";
	const extra = overrides?.extraFrontmatterLines ?? [];
	const prose = overrides?.proseBody ?? "Some prose body.\n";
	const playbook = overrides?.playbookBody ?? "Some playbook body.\n";
	const studyPlaybook = overrides?.studyPlaybookBody ?? "Some study playbook body.\n";
	const research = overrides?.researchBody ?? "Some research body.\n";

	const frontmatterLines = [
		`name: ${name}`,
		"mcpServerConfig:",
		"  command: npx",
		"  args:",
		'    - "@example/mcp-launcher"',
		'    - "D:/brains/my-brain"',
		...extra,
	];

	return (
		`---\n${frontmatterLines.join("\n")}\n---\n\n` +
		`<!-- aide-prose-start -->\n${prose}<!-- aide-prose-end -->\n\n` +
		`<!-- aide-playbook-start -->\n${playbook}<!-- aide-playbook-end -->\n\n` +
		`<!-- aide-study-playbook-start -->\n${studyPlaybook}<!-- aide-study-playbook-end -->\n\n` +
		`<!-- aide-research-start -->\n${research}<!-- aide-research-end -->\n`
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
// 3b. Happy path — asserts on all four body fields (marker grammar)
// ---------------------------------------------------------------------------

describe("3a — happy path", () => {
	it("returns ok with two-field config and all four body sections", async () => {
		await writeBrainAide(tempDir, CANONICAL_BRAIN_AIDE);

		const result = await parseBrainAide(tempDir);

		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return;

		expect(result.config.name).toBe("my-brain");
		expect(result.config.mcpServerConfig.command).toBe("npx");
		expect(result.config.mcpServerConfig.args).toEqual(["@example/mcp-launcher", "D:/brains/my-brain"]);

		// prose: verbatim bytes between <!-- aide-prose-start --> and <!-- aide-prose-end -->
		expect(result.prose).toBe(extractCanonicalSection("prose"));
		expect(result.prose).toMatch(/Your brain is an external knowledge store/);

		// playbook: verbatim bytes between <!-- aide-playbook-start --> and <!-- aide-playbook-end -->
		expect(result.playbook).toBe(extractCanonicalSection("playbook"));

		// studyPlaybook: verbatim bytes between <!-- aide-study-playbook-start --> and <!-- aide-study-playbook-end -->
		expect(result.studyPlaybook).toBe(extractCanonicalSection("studyPlaybook"));
		expect(result.studyPlaybook).toMatch(/Start at the playbook hub/);

		// research: verbatim bytes between <!-- aide-research-start --> and <!-- aide-research-end -->
		expect(result.research).toBe(extractCanonicalSection("research"));
	});

	it("literal # H1 and ## headings inside sections pass through verbatim — marker grammar is bytes not lines", async () => {
		// The CANONICAL_BRAIN_AIDE fixture includes `# Coding playbook` (H1) and `## Task routing`
		// and `### Sections` inside the playbook section, plus `# Study playbook` (H1) inside the
		// studyPlaybook section, plus `# Research`, `## Domains`, and `### Example domain` inside the
		// research section. The marker walker slices between marker byte offsets — it never inspects
		// line structure, so these heading characters are content.
		await writeBrainAide(tempDir, CANONICAL_BRAIN_AIDE);
		const result = await parseBrainAide(tempDir);

		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return;

		expect(result.playbook).toContain("# Coding playbook");
		expect(result.playbook).toContain("## Task routing");
		expect(result.playbook).toContain("### Sections");
		expect(result.studyPlaybook).toContain("# Study playbook");
		expect(result.research).toContain("# Research");
		expect(result.research).toContain("## Domains");
		expect(result.research).toContain("### Example domain");
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
// 3c. Malformed YAML — fixture body updated to use four marker pairs
// ---------------------------------------------------------------------------

describe("3c — malformed YAML frontmatter", () => {
	it("returns malformed-frontmatter with a non-empty reason for invalid YAML", async () => {
		const badYaml = `---
mcpServerConfig:
  args: [unclosed bracket
---

<!-- aide-prose-start -->
Some prose.
<!-- aide-prose-end -->

<!-- aide-playbook-start -->
Some playbook.
<!-- aide-playbook-end -->

<!-- aide-study-playbook-start -->
Some study playbook.
<!-- aide-study-playbook-end -->

<!-- aide-research-start -->
Some research.
<!-- aide-research-end -->
`;
		await writeBrainAide(tempDir, badYaml);

		const result = await parseBrainAide(tempDir);

		expect(result.kind).toBe("malformed-frontmatter");
		if (result.kind !== "malformed-frontmatter") return;
		expect(result.reason.length).toBeGreaterThan(0);
	});
});

// ---------------------------------------------------------------------------
// 3d. Missing required field (parameterized) — bodies updated to four marker pairs
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
			`<!-- aide-prose-start -->\nSome prose body.\n<!-- aide-prose-end -->\n\n` +
			`<!-- aide-playbook-start -->\nSome playbook body.\n<!-- aide-playbook-end -->\n\n` +
			`<!-- aide-study-playbook-start -->\nSome study playbook body.\n<!-- aide-study-playbook-end -->\n\n` +
			`<!-- aide-research-start -->\nSome research body.\n<!-- aide-research-end -->\n`
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
// 3d'. Deprecated-field rejection (parameterized) — bodies updated to four marker pairs
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
			`<!-- aide-prose-start -->\nSome prose body.\n<!-- aide-prose-end -->\n\n` +
			`<!-- aide-playbook-start -->\nSome playbook body.\n<!-- aide-playbook-end -->\n\n` +
			`<!-- aide-study-playbook-start -->\nSome study playbook body.\n<!-- aide-study-playbook-end -->\n\n` +
			`<!-- aide-research-start -->\nSome research body.\n<!-- aide-research-end -->\n`;

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
		"<!-- aide-prose-start -->",
		"<!-- aide-prose-end -->",
		"<!-- aide-playbook-start -->",
		"<!-- aide-playbook-end -->",
		"<!-- aide-study-playbook-start -->",
		"<!-- aide-study-playbook-end -->",
		"<!-- aide-research-start -->",
		"<!-- aide-research-end -->",
	];

	const missingPairCases: Array<[string, string, string]> = [
		[
			"missing prose pair only",
			validFrontmatter + bodyWithMarkers(allMarkers.filter((m) => !m.includes("prose"))),
			"missing markers: <!-- aide-prose-start -->, <!-- aide-prose-end -->",
		],
		[
			"missing playbook pair only",
			validFrontmatter + bodyWithMarkers(allMarkers.filter((m) => !m.includes("aide-playbook-"))),
			"missing markers: <!-- aide-playbook-start -->, <!-- aide-playbook-end -->",
		],
		[
			"missing studyPlaybook pair only",
			validFrontmatter + bodyWithMarkers(allMarkers.filter((m) => !m.includes("study-playbook"))),
			"missing markers: <!-- aide-study-playbook-start -->, <!-- aide-study-playbook-end -->",
		],
		[
			"missing research pair only",
			validFrontmatter + bodyWithMarkers(allMarkers.filter((m) => !m.includes("research"))),
			"missing markers: <!-- aide-research-start -->, <!-- aide-research-end -->",
		],
		[
			"missing prose and research pairs",
			validFrontmatter + bodyWithMarkers(allMarkers.filter((m) => !m.includes("prose") && !m.includes("research"))),
			"missing markers: <!-- aide-prose-start -->, <!-- aide-prose-end -->, <!-- aide-research-start -->, <!-- aide-research-end -->",
		],
		[
			"missing prose and playbook pairs",
			validFrontmatter + bodyWithMarkers(allMarkers.filter((m) => !m.includes("prose") && !m.includes("aide-playbook-"))),
			"missing markers: <!-- aide-prose-start -->, <!-- aide-prose-end -->, <!-- aide-playbook-start -->, <!-- aide-playbook-end -->",
		],
		[
			"missing playbook and research pairs",
			validFrontmatter + bodyWithMarkers(allMarkers.filter((m) => !m.includes("aide-playbook-") && !m.includes("research"))),
			"missing markers: <!-- aide-playbook-start -->, <!-- aide-playbook-end -->, <!-- aide-research-start -->, <!-- aide-research-end -->",
		],
		[
			"missing prose and studyPlaybook pairs",
			validFrontmatter + bodyWithMarkers(allMarkers.filter((m) => !m.includes("prose") && !m.includes("study-playbook"))),
			"missing markers: <!-- aide-prose-start -->, <!-- aide-prose-end -->, <!-- aide-study-playbook-start -->, <!-- aide-study-playbook-end -->",
		],
		[
			"missing playbook and studyPlaybook pairs",
			validFrontmatter + bodyWithMarkers(allMarkers.filter((m) => !m.includes("aide-playbook-") && !m.includes("study-playbook"))),
			"missing markers: <!-- aide-playbook-start -->, <!-- aide-playbook-end -->, <!-- aide-study-playbook-start -->, <!-- aide-study-playbook-end -->",
		],
		[
			"missing studyPlaybook and research pairs",
			validFrontmatter + bodyWithMarkers(allMarkers.filter((m) => !m.includes("study-playbook") && !m.includes("research"))),
			"missing markers: <!-- aide-study-playbook-start -->, <!-- aide-study-playbook-end -->, <!-- aide-research-start -->, <!-- aide-research-end -->",
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
	it("prose opener present but closer missing → unmatched opening marker", async () => {
		const content =
			validFrontmatter +
			`<!-- aide-prose-start -->\nSome prose.\n\n` +
			`<!-- aide-playbook-start -->\nSome playbook.\n<!-- aide-playbook-end -->\n\n` +
			`<!-- aide-study-playbook-start -->\nSome study playbook.\n<!-- aide-study-playbook-end -->\n\n` +
			`<!-- aide-research-start -->\nSome research.\n<!-- aide-research-end -->\n`;

		await writeBrainAide(tempDir, content);
		const result = await parseBrainAide(tempDir);

		expect(result.kind).toBe("malformed-body");
		if (result.kind !== "malformed-body") return;
		expect(result.reason).toBe(
			"unmatched opening marker: <!-- aide-prose-start --> has no matching <!-- aide-prose-end -->",
		);
	});

	// Unmatched-closer case: closer present, opener missing.
	it("prose closer present but opener missing → unmatched closing marker", async () => {
		const content =
			validFrontmatter +
			`Some prose content without an opener.\n<!-- aide-prose-end -->\n\n` +
			`<!-- aide-playbook-start -->\nSome playbook.\n<!-- aide-playbook-end -->\n\n` +
			`<!-- aide-study-playbook-start -->\nSome study playbook.\n<!-- aide-study-playbook-end -->\n\n` +
			`<!-- aide-research-start -->\nSome research.\n<!-- aide-research-end -->\n`;

		await writeBrainAide(tempDir, content);
		const result = await parseBrainAide(tempDir);

		expect(result.kind).toBe("malformed-body");
		if (result.kind !== "malformed-body") return;
		expect(result.reason).toBe(
			"unmatched closing marker: <!-- aide-prose-end --> appeared without a prior <!-- aide-prose-start -->",
		);
	});

	// Unmatched-opener case for studyPlaybook section.
	it("studyPlaybook opener present but closer missing → unmatched opening marker", async () => {
		const content =
			validFrontmatter +
			`<!-- aide-prose-start -->\nSome prose.\n<!-- aide-prose-end -->\n\n` +
			`<!-- aide-playbook-start -->\nSome playbook.\n<!-- aide-playbook-end -->\n\n` +
			`<!-- aide-study-playbook-start -->\nSome study playbook.\n\n` +
			`<!-- aide-research-start -->\nSome research.\n<!-- aide-research-end -->\n`;

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
			`<!-- aide-prose-start -->\nSome prose.\n<!-- aide-prose-end -->\n\n` +
			`<!-- aide-playbook-start -->\nSome playbook.\n<!-- aide-playbook-end -->\n\n` +
			`Some study playbook content without an opener.\n<!-- aide-study-playbook-end -->\n\n` +
			`<!-- aide-research-start -->\nSome research.\n<!-- aide-research-end -->\n`;

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
// replaced by a malformed variant; the other seven recognized markers are correctly
// present and paired. Each case asserts kind === "malformed-body" and the reason
// matches the literal "unknown marker: <as-written>" format.
// ---------------------------------------------------------------------------

describe("3f — malformed/typo'd marker rejection", () => {
	const validFrontmatter =
		`---\nname: my-brain\nmcpServerConfig:\n  command: npx\n  args:\n    - "@example/mcp-launcher"\n    - "D:/brains/my-brain"\n---\n\n`;

	/**
	 * Build a body where the prose opener is replaced by the given malformed marker.
	 * The remaining seven recognized markers are correctly present and paired, so the
	 * only failure is the substituted malformed token.
	 */
	function bodyWithMalformedProseOpener(malformedMarker: string): string {
		return (
			`${malformedMarker}\nSome prose.\n<!-- aide-prose-end -->\n\n` +
			`<!-- aide-playbook-start -->\nSome playbook.\n<!-- aide-playbook-end -->\n\n` +
			`<!-- aide-study-playbook-start -->\nSome study playbook.\n<!-- aide-study-playbook-end -->\n\n` +
			`<!-- aide-research-start -->\nSome research.\n<!-- aide-research-end -->\n`
		);
	}

	/**
	 * Build a body where the study-playbook opener is replaced by the given malformed marker.
	 * The remaining seven recognized markers are correctly present and paired, so the
	 * only failure is the substituted malformed token.
	 */
	function bodyWithMalformedStudyPlaybookOpener(malformedMarker: string): string {
		return (
			`<!-- aide-prose-start -->\nSome prose.\n<!-- aide-prose-end -->\n\n` +
			`<!-- aide-playbook-start -->\nSome playbook.\n<!-- aide-playbook-end -->\n\n` +
			`${malformedMarker}\nSome study playbook.\n<!-- aide-study-playbook-end -->\n\n` +
			`<!-- aide-research-start -->\nSome research.\n<!-- aide-research-end -->\n`
		);
	}

	const malformedCases: Array<[string, string, string]> = [
		[
			"uppercase variant",
			bodyWithMalformedProseOpener("<!-- AIDE-PROSE-START -->"),
			"unknown marker: <!-- AIDE-PROSE-START -->",
		],
		[
			"mixed-case variant",
			bodyWithMalformedProseOpener("<!-- Aide-prose-start -->"),
			"unknown marker: <!-- Aide-prose-start -->",
		],
		[
			"no surrounding spaces",
			bodyWithMalformedProseOpener("<!--aide-prose-start-->"),
			"unknown marker: <!--aide-prose-start-->",
		],
		[
			"extra internal whitespace (trailing)",
			bodyWithMalformedProseOpener("<!-- aide-prose-start  -->"),
			"unknown marker: <!-- aide-prose-start  -->",
		],
		[
			"extra internal whitespace (leading)",
			bodyWithMalformedProseOpener("<!--  aide-prose-start -->"),
			"unknown marker: <!--  aide-prose-start -->",
		],
		[
			"missing aide- prefix",
			bodyWithMalformedProseOpener("<!-- prose-start -->"),
			"unknown marker: <!-- prose-start -->",
		],
		[
			"typo in token (strart)",
			bodyWithMalformedProseOpener("<!-- aide-prose-strart -->"),
			"unknown marker: <!-- aide-prose-strart -->",
		],
		[
			"typo in section name (playboook)",
			(
				`<!-- aide-prose-start -->\nSome prose.\n<!-- aide-prose-end -->\n\n` +
				`<!-- aide-playboook-start -->\nSome playbook.\n<!-- aide-playbook-end -->\n\n` +
				`<!-- aide-study-playbook-start -->\nSome study playbook.\n<!-- aide-study-playbook-end -->\n\n` +
				`<!-- aide-research-start -->\nSome research.\n<!-- aide-research-end -->\n`
			),
			"unknown marker: <!-- aide-playboook-start -->",
		],
		[
			"typo in study-playbook section name (study-pllaybook)",
			(
				`<!-- aide-prose-start -->\nSome prose.\n<!-- aide-prose-end -->\n\n` +
				`<!-- aide-playbook-start -->\nSome playbook.\n<!-- aide-playbook-end -->\n\n` +
				`<!-- aide-study-pllaybook-start -->\nSome study playbook.\n<!-- aide-study-playbook-end -->\n\n` +
				`<!-- aide-research-start -->\nSome research.\n<!-- aide-research-end -->\n`
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
		// Body has two malformed markers: an uppercase prose opener AND a mixed-case
		// playbook opener. The parser surfaces one error per parse; it must name the
		// first malformed marker encountered left-to-right in document order.
		const content =
			validFrontmatter +
			`<!-- AIDE-PROSE-START -->\nSome prose.\n<!-- aide-prose-end -->\n\n` +
			`<!-- Aide-playbook-start -->\nSome playbook.\n<!-- aide-playbook-end -->\n\n` +
			`<!-- aide-study-playbook-start -->\nSome study playbook.\n<!-- aide-study-playbook-end -->\n\n` +
			`<!-- aide-research-start -->\nSome research.\n<!-- aide-research-end -->\n`;

		await writeBrainAide(tempDir, content);
		const result = await parseBrainAide(tempDir);

		expect(result.kind).toBe("malformed-body");
		if (result.kind !== "malformed-body") return;
		// The first malformed marker left-to-right is <!-- AIDE-PROSE-START -->.
		expect(result.reason).toBe("unknown marker: <!-- AIDE-PROSE-START -->");
	});
});

// ---------------------------------------------------------------------------
// 3g. Marker order violation.
//
// Parameterized cases for every wrong order. Each fixture has all four pairs
// present and correctly matched; only the ORDER is wrong. Each case asserts
// kind === "malformed-body" and the literal reason.
// ---------------------------------------------------------------------------

describe("3g — marker order violation", () => {
	const validFrontmatter =
		`---\nname: my-brain\nmcpServerConfig:\n  command: npx\n  args:\n    - "@example/mcp-launcher"\n    - "D:/brains/my-brain"\n---\n\n`;

	const orderCases: Array<[string, string, string]> = [
		[
			"playbook before prose",
			validFrontmatter +
			`<!-- aide-playbook-start -->\nSome playbook.\n<!-- aide-playbook-end -->\n\n` +
			`<!-- aide-prose-start -->\nSome prose.\n<!-- aide-prose-end -->\n\n` +
			`<!-- aide-study-playbook-start -->\nSome study playbook.\n<!-- aide-study-playbook-end -->\n\n` +
			`<!-- aide-research-start -->\nSome research.\n<!-- aide-research-end -->\n`,
			"marker order violation: <!-- aide-playbook-start --> appeared before <!-- aide-prose-start -->",
		],
		[
			"research before playbook (prose first, correctly)",
			validFrontmatter +
			`<!-- aide-prose-start -->\nSome prose.\n<!-- aide-prose-end -->\n\n` +
			`<!-- aide-research-start -->\nSome research.\n<!-- aide-research-end -->\n\n` +
			`<!-- aide-playbook-start -->\nSome playbook.\n<!-- aide-playbook-end -->\n\n` +
			`<!-- aide-study-playbook-start -->\nSome study playbook.\n<!-- aide-study-playbook-end -->\n`,
			"marker order violation: <!-- aide-research-start --> appeared before <!-- aide-playbook-start -->",
		],
		[
			"research first (before prose and playbook)",
			validFrontmatter +
			`<!-- aide-research-start -->\nSome research.\n<!-- aide-research-end -->\n\n` +
			`<!-- aide-prose-start -->\nSome prose.\n<!-- aide-prose-end -->\n\n` +
			`<!-- aide-playbook-start -->\nSome playbook.\n<!-- aide-playbook-end -->\n\n` +
			`<!-- aide-study-playbook-start -->\nSome study playbook.\n<!-- aide-study-playbook-end -->\n`,
			"marker order violation: <!-- aide-research-start --> appeared before <!-- aide-prose-start -->",
		],
		[
			"study-playbook before playbook",
			validFrontmatter +
			`<!-- aide-prose-start -->\nSome prose.\n<!-- aide-prose-end -->\n\n` +
			`<!-- aide-study-playbook-start -->\nSome study playbook.\n<!-- aide-study-playbook-end -->\n\n` +
			`<!-- aide-playbook-start -->\nSome playbook.\n<!-- aide-playbook-end -->\n\n` +
			`<!-- aide-research-start -->\nSome research.\n<!-- aide-research-end -->\n`,
			"marker order violation: <!-- aide-study-playbook-start --> appeared before <!-- aide-playbook-start -->",
		],
		[
			"research before study-playbook",
			validFrontmatter +
			`<!-- aide-prose-start -->\nSome prose.\n<!-- aide-prose-end -->\n\n` +
			`<!-- aide-playbook-start -->\nSome playbook.\n<!-- aide-playbook-end -->\n\n` +
			`<!-- aide-research-start -->\nSome research.\n<!-- aide-research-end -->\n\n` +
			`<!-- aide-study-playbook-start -->\nSome study playbook.\n<!-- aide-study-playbook-end -->\n`,
			"marker order violation: <!-- aide-research-start --> appeared before <!-- aide-study-playbook-start -->",
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
// Parameterized cases covering each nesting class. Each fixture has all eight
// recognized marker tokens present and well-formed in document order; only
// the BYTE OFFSETS put one marker (or pair) inside another pair's span.
// Each case asserts kind === "malformed-body" and the literal reason.
// ---------------------------------------------------------------------------

describe("3h — nested marker rejection", () => {
	const validFrontmatter =
		`---\nname: my-brain\nmcpServerConfig:\n  command: npx\n  args:\n    - "@example/mcp-launcher"\n    - "D:/brains/my-brain"\n---\n\n`;

	const nestingCases: Array<[string, string, string]> = [
		[
			"playbook pair nested inside prose pair",
			validFrontmatter +
			`<!-- aide-prose-start -->\n` +
			`Some prose content.\n` +
			`<!-- aide-playbook-start -->\nNested playbook.\n<!-- aide-playbook-end -->\n` +
			`More prose content.\n` +
			`<!-- aide-prose-end -->\n\n` +
			`<!-- aide-study-playbook-start -->\nSome study playbook.\n<!-- aide-study-playbook-end -->\n\n` +
			`<!-- aide-research-start -->\nSome research.\n<!-- aide-research-end -->\n`,
			"nested marker: <!-- aide-playbook-start --> appeared inside the prose section",
		],
		[
			"research pair nested inside study-playbook pair",
			validFrontmatter +
			`<!-- aide-prose-start -->\nSome prose.\n<!-- aide-prose-end -->\n\n` +
			`<!-- aide-playbook-start -->\nSome playbook content.\n<!-- aide-playbook-end -->\n\n` +
			`<!-- aide-study-playbook-start -->\n` +
			`Some study playbook content.\n` +
			`<!-- aide-research-start -->\nNested research.\n<!-- aide-research-end -->\n` +
			`More study playbook content.\n` +
			`<!-- aide-study-playbook-end -->\n`,
			"nested marker: <!-- aide-research-start --> appeared inside the studyPlaybook section",
		],
		[
			"stray playbook closer inside research pair",
			// All eight markers present in correct order; research's content span
			// contains a duplicate playbook closer. Openers in document order:
			// prose-start, playbook-start, study-playbook-start, research-start — correct order
			// (no order violation). Unmatched-closer check passes because seenOpeners already
			// has "playbook" when the inner playbook-end is encountered. The nesting
			// check fires because the inner playbook-end falls inside the research span.
			validFrontmatter +
			`<!-- aide-prose-start -->\nSome prose.\n<!-- aide-prose-end -->\n\n` +
			`<!-- aide-playbook-start -->\nSome playbook.\n<!-- aide-playbook-end -->\n\n` +
			`<!-- aide-study-playbook-start -->\nSome study playbook.\n<!-- aide-study-playbook-end -->\n\n` +
			`<!-- aide-research-start -->\n` +
			`Some research content.\n` +
			`<!-- aide-playbook-end -->\n` +
			`More research.\n` +
			`<!-- aide-research-end -->\n`,
			"nested marker: <!-- aide-playbook-end --> appeared inside the research section",
		],
		[
			"single stray inner opener (no full inner pair) inside a pair",
			validFrontmatter +
			`<!-- aide-prose-start -->\n` +
			`Some prose content.\n` +
			`<!-- aide-playbook-start -->\n` +
			`Stray opener, no matching closer inside prose.\n` +
			`<!-- aide-prose-end -->\n\n` +
			`<!-- aide-playbook-end -->\n\n` +
			`<!-- aide-study-playbook-start -->\nSome study playbook.\n<!-- aide-study-playbook-end -->\n\n` +
			`<!-- aide-research-start -->\nSome research.\n<!-- aide-research-end -->\n`,
			"nested marker: <!-- aide-playbook-start --> appeared inside the prose section",
		],
		[
			"study-playbook pair nested inside playbook pair",
			// The navigation prose belongs with the playbook — a tempting containment the spec names.
			// prose pair, then playbook opener, then study-playbook pair fully nested inside the playbook
			// span, then playbook closer, then research pair.
			validFrontmatter +
			`<!-- aide-prose-start -->\nSome prose.\n<!-- aide-prose-end -->\n\n` +
			`<!-- aide-playbook-start -->\n` +
			`Some playbook content.\n` +
			`<!-- aide-study-playbook-start -->\nNested study playbook.\n<!-- aide-study-playbook-end -->\n` +
			`More playbook content.\n` +
			`<!-- aide-playbook-end -->\n\n` +
			`<!-- aide-research-start -->\nSome research.\n<!-- aide-research-end -->\n`,
			"nested marker: <!-- aide-study-playbook-start --> appeared inside the playbook section",
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
// anywhere returns malformed-body naming all eight missing markers.
//
// This test is tied to preventing the regression described in the spec's "Bad examples":
// "A parser that auto-fills missing required body sections from package defaults."
// The parser must NOT auto-detect the old heading-based shape, auto-rewrite, or
// silently default the missing sections. The user hand-edits their file.
// ---------------------------------------------------------------------------

describe("3i — strict-failure migration: pre-pivot heading-based body", () => {
	it("heading-based body with no marker pairs returns malformed-body naming all eight missing markers", async () => {
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
		// Strict failure: all eight missing markers listed in one reason so the user
		// fixes them all in one edit.
		expect(result.kind).toBe("malformed-body");
		if (result.kind !== "malformed-body") return;
		expect(result.reason).toBe(
			"missing markers: <!-- aide-prose-start -->, <!-- aide-prose-end -->, <!-- aide-playbook-start -->, <!-- aide-playbook-end -->, <!-- aide-study-playbook-start -->, <!-- aide-study-playbook-end -->, <!-- aide-research-start -->, <!-- aide-research-end -->",
		);
	});
});

// ---------------------------------------------------------------------------
// 3i'. Strict-failure migration: pre-pivot three-pair marker-bounded body.
//
// Spec outcome #7: "a brain.aide carrying the prior three-pair marker-bounded
// body returns malformed-body with a reason naming the missing study-playbook
// markers specifically."
//
// This test PINS the strict-failure contract against future "helpful" three-pair-
// tolerant fallbacks. The spec's "Bad examples" block calls this anti-pattern out
// by name: a parser that detects a three-pair body and silently defaults the
// missing studyPlaybook section to an empty string is wrong. The parser does NOT
// auto-detect the three-pair shape, does NOT auto-rewrite, does NOT silently
// default the missing studyPlaybook section to an empty string, and there is no
// aide_upgrade carve-out — strict failure is the only resolution path.
//
// Without this test a future maintainer might delete 3e's "missing studyPlaybook
// pair only" case as redundant — but that case uses a four-marker body with one
// pair removed, while this case uses the exact three-pair body shape that predates
// the four-section grammar. The distinction matters: a "helpful" parser might
// special-case the three-pair shape without being caught by the four-minus-one test.
// ---------------------------------------------------------------------------

describe("3i' — strict-failure migration: pre-pivot three-pair body", () => {
	it("three-pair marker-bounded body (prose + playbook + research, no studyPlaybook) returns malformed-body naming the missing study-playbook markers", async () => {
		// This fixture is the exact three-pair body shape that predates the four-section
		// grammar. Build it by concatenating the three marker-pair blocks from
		// MARKER_OPENERS / MARKER_CLOSERS in the correct prose-then-playbook-then-research
		// order — the same order the old grammar required.
		const validFrontmatter =
			`---\nname: my-brain\nmcpServerConfig:\n  command: npx\n  args:\n    - "@example/mcp-launcher"\n    - "D:/brains/my-brain"\n---\n\n`;
		const threePairBody =
			`${MARKER_OPENERS.prose}\nSome prose content.\n${MARKER_CLOSERS.prose}\n\n` +
			`${MARKER_OPENERS.playbook}\nSome playbook content.\n${MARKER_CLOSERS.playbook}\n\n` +
			`${MARKER_OPENERS.research}\nSome research content.\n${MARKER_CLOSERS.research}\n`;
		const prePivotThreePairContent = validFrontmatter + threePairBody;

		await writeBrainAide(tempDir, prePivotThreePairContent);

		const result = await parseBrainAide(tempDir);

		// Spec outcome #7: "a brain.aide carrying the prior three-pair marker-bounded body
		// returns malformed-body with a reason naming the missing study-playbook markers
		// specifically."
		//
		// The parser does NOT auto-detect the three-pair shape, does NOT auto-rewrite,
		// does NOT silently default the missing studyPlaybook section to an empty string,
		// and there is no aide_upgrade carve-out — strict failure is the only resolution
		// path. This test exists to PIN that contract against future "helpful" fallbacks
		// that would be indistinguishable from a green test in 3e's parameterized suite.
		expect(result.kind).toBe("malformed-body");
		if (result.kind !== "malformed-body") return;
		expect(result.reason).toBe(
			"missing markers: <!-- aide-study-playbook-start -->, <!-- aide-study-playbook-end -->",
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
// With four sections there are now FIVE gap positions:
//   1. frontmatter → prose
//   2. prose closer → playbook opener
//   3. playbook closer → study-playbook opener
//   4. study-playbook closer → research opener
//   5. after research closer
//
// Contract decision for the marker-shaped-outside case:
//   The malformed-marker scan respects pair boundaries — only marker-shaped tokens
//   that are NOT inside any recognized matched pair AND are not one of the eight exact
//   recognized sequences are flagged as malformed. A token like `<!-- aide-misc -->`
//   between two recognized pairs is treated as plain bytes (per the spec's
//   "Bytes outside any marker pair are silently ignored" rule) because the scan
//   excludes regions inside recognized pairs and the token does not match any of
//   the eight exact recognized forms.
// ---------------------------------------------------------------------------

describe("3j — bytes outside marker pairs are silently ignored", () => {
	const validFrontmatter =
		`---\nname: my-brain\nmcpServerConfig:\n  command: npx\n  args:\n    - "@example/mcp-launcher"\n    - "D:/brains/my-brain"\n---\n\n`;

	const proseSection = `<!-- aide-prose-start -->\nSome prose.\n<!-- aide-prose-end -->`;
	const playbookSection = `<!-- aide-playbook-start -->\nSome playbook.\n<!-- aide-playbook-end -->`;
	const studyPlaybookSection = `<!-- aide-study-playbook-start -->\nSome study playbook.\n<!-- aide-study-playbook-end -->`;
	const researchSection = `<!-- aide-research-start -->\nSome research.\n<!-- aide-research-end -->`;

	const outsideCases: Array<[string, string]> = [
		[
			"scratch text between frontmatter and prose opener",
			validFrontmatter +
			`A note-to-self before the first section.\n\n` +
			`${proseSection}\n\n${playbookSection}\n\n${studyPlaybookSection}\n\n${researchSection}\n`,
		],
		[
			"scratch text between prose closer and playbook opener",
			validFrontmatter +
			`${proseSection}\n\nScratch text between prose and playbook.\n\n${playbookSection}\n\n${studyPlaybookSection}\n\n${researchSection}\n`,
		],
		[
			"scratch text between playbook closer and study-playbook opener",
			validFrontmatter +
			`${proseSection}\n\n${playbookSection}\n\nScratch text between playbook and study-playbook.\n\n${studyPlaybookSection}\n\n${researchSection}\n`,
		],
		[
			"scratch text between study-playbook closer and research opener",
			validFrontmatter +
			`${proseSection}\n\n${playbookSection}\n\n${studyPlaybookSection}\n\nScratch text between study-playbook and research.\n\n${researchSection}\n`,
		],
		[
			"trailing comment after the research closer",
			validFrontmatter +
			`${proseSection}\n\n${playbookSection}\n\n${studyPlaybookSection}\n\n${researchSection}\n\nA trailing comment after all sections.\n`,
		],
		[
			"all five gap positions populated simultaneously",
			validFrontmatter +
			`Before prose.\n\n${proseSection}\n\nBetween prose and playbook.\n\n${playbookSection}\n\nBetween playbook and study-playbook.\n\n${studyPlaybookSection}\n\nBetween study-playbook and research.\n\n${researchSection}\n\nAfter research.\n`,
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
			`${proseSection}\n\n<!-- aide-misc -->\n\n${playbookSection}\n\n${studyPlaybookSection}\n\n${researchSection}\n`,
		],
	];

	it.each(outsideCases)("%s → ok (outside bytes silently ignored)", async (_description, content) => {
		await writeBrainAide(tempDir, content);

		const result = await parseBrainAide(tempDir);

		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return;

		// Each section contains only its own bytes — none of the outside text leaks in.
		expect(result.prose).toBe("\nSome prose.\n");
		expect(result.playbook).toBe("\nSome playbook.\n");
		expect(result.studyPlaybook).toBe("\nSome study playbook.\n");
		expect(result.research).toBe("\nSome research.\n");
	});
});

// ---------------------------------------------------------------------------
// 3k. Verbatim invariant extends to all four body sections (no substitution).
// Four sub-tests, one per section: prose, playbook, studyPlaybook, research.
// ---------------------------------------------------------------------------

describe("3k — all body sections returned verbatim (no-substitution invariant)", () => {
	it("prose containing literal ${name} and ${rootPath} passes through byte-identical", async () => {
		const literalProseBody = `This is a prose body with a literal \${name} placeholder.

It also has **markdown** and a [link](https://example.com).

The \${rootPath} value is also here for good measure.
`;
		const content =
			`---\nname: my-brain\nmcpServerConfig:\n  command: npx\n  args:\n    - "@example/mcp-launcher"\n    - "D:/brains/my-brain"\n---\n\n` +
			`<!-- aide-prose-start -->\n${literalProseBody}<!-- aide-prose-end -->\n\n` +
			`<!-- aide-playbook-start -->\nSome playbook content.\n<!-- aide-playbook-end -->\n\n` +
			`<!-- aide-study-playbook-start -->\nSome study playbook content.\n<!-- aide-study-playbook-end -->\n\n` +
			`<!-- aide-research-start -->\nSome research content.\n<!-- aide-research-end -->\n`;

		await writeBrainAide(tempDir, content);

		const result = await parseBrainAide(tempDir);

		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return;
		// The prose must contain the literal ${name} unchanged — no substitution.
		expect(result.prose).toContain("${name}");
		// ${rootPath} in prose is body text, not a deprecated frontmatter field — passes through.
		expect(result.prose).toContain("${rootPath}");
		expect(result.prose).toContain("**markdown**");
		// Full byte-identity: slice starts at opener.index + opener.length.
		expect(result.prose).toBe(`\n${literalProseBody}`);
	});

	it("playbook containing literal ${name} passes through byte-identical", async () => {
		const playbookBody = `This playbook section contains \${name} literally.

The \${name} placeholder should not be substituted here.
`;
		const content =
			`---\nname: my-brain\nmcpServerConfig:\n  command: npx\n  args:\n    - "@example/mcp-launcher"\n    - "D:/brains/my-brain"\n---\n\n` +
			`<!-- aide-prose-start -->\nSome prose.\n<!-- aide-prose-end -->\n\n` +
			`<!-- aide-playbook-start -->\n${playbookBody}<!-- aide-playbook-end -->\n\n` +
			`<!-- aide-study-playbook-start -->\nSome study playbook content.\n<!-- aide-study-playbook-end -->\n\n` +
			`<!-- aide-research-start -->\nSome research.\n<!-- aide-research-end -->\n`;

		await writeBrainAide(tempDir, content);

		const result = await parseBrainAide(tempDir);

		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return;
		// The playbook must contain the literal ${name} unchanged.
		expect(result.playbook).toContain("${name}");
		// Substitution only runs on mcpServerConfig.args — not on any body section.
		expect(result.playbook).not.toContain("my-brain");
	});

	it("studyPlaybook containing literal ${name} passes through byte-identical", async () => {
		const studyPlaybookBody = `This study playbook section contains \${name} literally.

The \${name} placeholder should not be substituted here.

The \${rootPath} value is also here for good measure.
`;
		const content =
			`---\nname: my-brain\nmcpServerConfig:\n  command: npx\n  args:\n    - "@example/mcp-launcher"\n    - "D:/brains/my-brain"\n---\n\n` +
			`<!-- aide-prose-start -->\nSome prose.\n<!-- aide-prose-end -->\n\n` +
			`<!-- aide-playbook-start -->\nSome playbook.\n<!-- aide-playbook-end -->\n\n` +
			`<!-- aide-study-playbook-start -->\n${studyPlaybookBody}<!-- aide-study-playbook-end -->\n\n` +
			`<!-- aide-research-start -->\nSome research.\n<!-- aide-research-end -->\n`;

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

	it("research containing literal ${name} passes through byte-identical", async () => {
		const researchBody = `This research section contains \${name} literally.

The \${name} placeholder should not be substituted here either.
`;
		const content =
			`---\nname: my-brain\nmcpServerConfig:\n  command: npx\n  args:\n    - "@example/mcp-launcher"\n    - "D:/brains/my-brain"\n---\n\n` +
			`<!-- aide-prose-start -->\nSome prose.\n<!-- aide-prose-end -->\n\n` +
			`<!-- aide-playbook-start -->\nSome playbook.\n<!-- aide-playbook-end -->\n\n` +
			`<!-- aide-study-playbook-start -->\nSome study playbook.\n<!-- aide-study-playbook-end -->\n\n` +
			`<!-- aide-research-start -->\n${researchBody}<!-- aide-research-end -->\n`;

		await writeBrainAide(tempDir, content);

		const result = await parseBrainAide(tempDir);

		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return;
		// The research must contain the literal ${name} unchanged.
		expect(result.research).toContain("${name}");
		// Substitution only runs on mcpServerConfig.args — not on any body section.
		expect(result.research).not.toContain("my-brain");
	});
});

// ---------------------------------------------------------------------------
// 3l. Name is metadata, not dispatched on — fixtures rebuilt with four marker pairs.
// ---------------------------------------------------------------------------

describe("3l — name is metadata, not dispatched on", () => {
	function makeContentWithName(name: string): string {
		return (
			`---\nname: ${name}\nmcpServerConfig:\n  command: npx\n  args:\n    - "@example/mcp-launcher"\n    - "D:/brains/my-brain"\n---\n\n` +
			`<!-- aide-prose-start -->\nProse body for ${name} brain.\n<!-- aide-prose-end -->\n\n` +
			`<!-- aide-playbook-start -->\nPlaybook body for ${name} brain.\n<!-- aide-playbook-end -->\n\n` +
			`<!-- aide-study-playbook-start -->\nStudy playbook body for ${name} brain.\n<!-- aide-study-playbook-end -->\n\n` +
			`<!-- aide-research-start -->\nResearch body for ${name} brain.\n<!-- aide-research-end -->\n`
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
			expect(resultA.config.name).toBe("brain-a");
			expect(resultB.config.name).toBe("brain-b");

			// mcpServerConfig is identical — name did not influence it.
			expect(resultA.config.mcpServerConfig).toEqual(resultB.config.mcpServerConfig);

			// Both prose bodies pass through verbatim (no name-based rewriting).
			// The slice starts immediately after the prose opener byte sequence,
			// so the leading \n (newline after the opener) is included verbatim.
			expect(resultA.prose).toBe("\nProse body for brain-a brain.\n");
			expect(resultB.prose).toBe("\nProse body for brain-b brain.\n");
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

		const proseBeforeInterpolation = parseResult.prose;
		const playbookBeforeInterpolation = parseResult.playbook;
		const studyPlaybookBeforeInterpolation = parseResult.studyPlaybook;
		const researchBeforeInterpolation = parseResult.research;

		// interpolateArgs only accepts config — body sections are structurally excluded from its signature.
		const interpolated = interpolateArgs(parseResult.config);

		// Calling interpolateArgs did not affect any body string.
		expect(parseResult.prose).toBe(proseBeforeInterpolation);
		expect(parseResult.playbook).toBe(playbookBeforeInterpolation);
		expect(parseResult.studyPlaybook).toBe(studyPlaybookBeforeInterpolation);
		expect(parseResult.research).toBe(researchBeforeInterpolation);
		// The interpolated result is the args array — no body strings in the return value.
		expect(Array.isArray(interpolated)).toBe(true);
		expect(interpolated).not.toContain(proseBeforeInterpolation);
	});
});

// ---------------------------------------------------------------------------
// 3n. parseBrainAideFromString parity tests.
//
// Fixtures rebuilt with four marker pairs; noPlaybookContent updated to include
// the study-playbook pair. The malformed-body parity sub-test asserts that disk
// and string paths produce the same reason for a missing pair.
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

<!-- aide-prose-start -->
Prose.
<!-- aide-prose-end -->

<!-- aide-playbook-start -->
Playbook.
<!-- aide-playbook-end -->

<!-- aide-study-playbook-start -->
Study playbook.
<!-- aide-study-playbook-end -->

<!-- aide-research-start -->
Research.
<!-- aide-research-end -->
`;
		await writeBrainAide(tempDir, badYaml);

		const fromDisk = await parseBrainAide(tempDir);
		const fromString = parseBrainAideFromString(badYaml);

		expect(fromDisk.kind).toBe("malformed-frontmatter");
		expect(fromString.kind).toBe("malformed-frontmatter");
		expect(fromDisk).toEqual(fromString);
	});

	it("malformed-body — missing playbook pair parses identically via both paths", async () => {
		// Body has prose, study-playbook, and research marker pairs but is missing the playbook pair —
		// both disk and string paths must return the same malformed-body reason.
		const noPlaybookContent = `---
name: my-brain
mcpServerConfig:
  command: npx
  args:
    - "@example/mcp-launcher"
    - "D:/brains/my-brain"
---

<!-- aide-prose-start -->
Some prose.
<!-- aide-prose-end -->

<!-- aide-study-playbook-start -->
Some study playbook.
<!-- aide-study-playbook-end -->

<!-- aide-research-start -->
Some research.
<!-- aide-research-end -->
`;
		await writeBrainAide(tempDir, noPlaybookContent);

		const fromDisk = await parseBrainAide(tempDir);
		const fromString = parseBrainAideFromString(noPlaybookContent);

		expect(fromDisk.kind).toBe("malformed-body");
		expect(fromString.kind).toBe("malformed-body");
		if (fromDisk.kind !== "malformed-body" || fromString.kind !== "malformed-body") return;
		// Both paths return the same reason naming the missing pair.
		expect(fromDisk.reason).toBe(
			"missing markers: <!-- aide-playbook-start -->, <!-- aide-playbook-end -->",
		);
		expect(fromDisk).toEqual(fromString);
	});

	it("malformed-body — missing studyPlaybook pair parses identically via both paths", async () => {
		// Mirror the noPlaybookContent fixture: body has prose, playbook, and research marker
		// pairs but is missing the study-playbook pair. Both disk and string paths must return
		// the same malformed-body reason naming the missing study-playbook markers specifically.
		// This proves the disk and string paths agree on the new pair's missing-pair detection.
		const noStudyPlaybookContent = `---
name: my-brain
mcpServerConfig:
  command: npx
  args:
    - "@example/mcp-launcher"
    - "D:/brains/my-brain"
---

<!-- aide-prose-start -->
Some prose.
<!-- aide-prose-end -->

<!-- aide-playbook-start -->
Some playbook.
<!-- aide-playbook-end -->

<!-- aide-research-start -->
Some research.
<!-- aide-research-end -->
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
// 3o. Per-section ownership: result.config does NOT contain prose/playbook/studyPlaybook/research.
//
// Asserts the type boundary: body sections are siblings on the ok variant,
// NOT properties of config. Also confirms the renamed fields (playbook, studyPlaybook,
// research) are present as siblings rather than the retired playbookHub/researchHub names.
// ---------------------------------------------------------------------------

describe("3o — per-section ownership: body fields are siblings of config, not properties of it", () => {
	it("result.config does not contain prose, playbook, studyPlaybook, or research; all four are string siblings", async () => {
		await writeBrainAide(tempDir, CANONICAL_BRAIN_AIDE);

		const result = await parseBrainAide(tempDir);

		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return;

		// Body sections are siblings on the ok variant, NOT properties of config.
		// A consumer that does `result.config.prose` is reaching into the wrong nesting level.
		// This test makes that contract visible so a future refactor that moves body sections
		// into config will fail visibly.
		expect(Object.prototype.hasOwnProperty.call(result.config, "prose")).toBe(false);
		expect(Object.prototype.hasOwnProperty.call(result.config, "playbook")).toBe(false);
		expect(Object.prototype.hasOwnProperty.call(result.config, "studyPlaybook")).toBe(false);
		expect(Object.prototype.hasOwnProperty.call(result.config, "research")).toBe(false);

		// Verify the body fields ARE present on result as string siblings of config.
		expect(typeof result.prose).toBe("string");
		expect(typeof result.playbook).toBe("string");
		expect(typeof result.studyPlaybook).toBe("string");
		expect(typeof result.research).toBe("string");
	});
});
