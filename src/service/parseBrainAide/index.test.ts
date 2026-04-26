import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import parseBrainAide, { parseBrainAideFromString, interpolateArgs } from "./index.js";
import type { BrainAideConfig } from "@/types/index.js";

// ---------------------------------------------------------------------------
// 3a. Shared fixture: the canonical brain.aide with all three required sections.
//
// Each section carries non-trivial content to prove the walker only treats
// `^## .+$` (exactly two hashes + space) as a section boundary — NOT `^# .+$`
// (one hash) or `^### .+$` (three hashes).
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

## Playbook hub

# Coding playbook

A hub for coding conventions, patterns, and architecture decisions.
Read this index first, then drill into the section that matches your
task.

This is a second paragraph to exercise the slicer on multi-paragraph content.

### Task routing

| Task type | Read first |
| --------- | ---------- |
| Naming    | Foundations |
| Testing   | Workflow |

## Research hub

# Research

A hub for domain research notes. Each subdirectory holds notes for a
single domain; read the domain hub before drilling into individual
notes.

This is a second paragraph in the research hub section.

### Domains

(Add domain hubs here as your research grows.)
`;

// 3b. CANONICAL_CONFIG — unchanged; frontmatter shape did not move.
const CANONICAL_CONFIG: BrainAideConfig = {
	name: "obsidian",
	mcpServerConfig: {
		command: "npx",
		args: ["@bitbonsai/mcpvault", "D:/notes/my-vault"],
	},
};

// ---------------------------------------------------------------------------
// Test helper: extract the verbatim bytes for a named section from the
// CANONICAL_BRAIN_AIDE fixture.  This makes assertions resilient to small
// body edits in 3a — the expected value is always derived from the fixture,
// not from a hardcoded string that can drift.
//
// The body that the parser sees is everything after the closing `---\n`
// fence, with a single leading `\n` stripped (that strip runs in
// parseBrainAideFromString before extractBodySections is called).
// Within extractBodySections, `prose` additionally strips its own single
// leading newline.  This helper replicates the same logic so the expected
// values match parser output exactly.
// ---------------------------------------------------------------------------

function extractCanonicalSection(name: "prose" | "playbookHub" | "researchHub"): string {
	// Reconstruct the body the same way parseBrainAideFromString does:
	// split off the frontmatter, drop the closing `---\n`, then strip one leading `\n`.
	const afterOpen = CANONICAL_BRAIN_AIDE.trimStart().slice(3); // drop opening ---
	const closeIndex = afterOpen.indexOf("\n---");
	const rawBody = afterOpen.slice(closeIndex + 4).replace(/^\n/, ""); // drop one leading \n

	const headingStrings: Record<string, string> = {
		prose: "## Prose",
		playbookHub: "## Playbook hub",
		researchHub: "## Research hub",
	};
	const heading = headingStrings[name];

	// Find all `^## .+$` headings and their start positions.
	const headingRegex = /^## .+$/gm;
	const sections: { heading: string; startIndex: number }[] = [];
	let match: RegExpExecArray | null;
	while ((match = headingRegex.exec(rawBody)) !== null) {
		sections.push({
			heading: match[0],
			startIndex: match.index + match[0].length + 1,
		});
	}

	const entry = sections.find((s) => s.heading === heading)!;
	const entryIdx = sections.indexOf(entry);
	const next = sections[entryIdx + 1];
	const upper = next !== undefined ? next.startIndex - next.heading.length - 1 : rawBody.length;
	const raw = rawBody.slice(entry.startIndex, upper);

	// prose strips one additional leading newline (backward-compat strip in the parser).
	return name === "prose" ? raw.replace(/^\n/, "") : raw;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function writeBrainAide(root: string, content: string): Promise<void> {
	await mkdir(join(root, ".aide", "config"), { recursive: true });
	await writeFile(join(root, ".aide", "config", "brain.aide"), content, "utf-8");
}

/** Build a minimal valid three-section brain.aide content string. */
function makeCanonicalContent(overrides?: {
	name?: string;
	extraFrontmatterLines?: string[];
	proseBody?: string;
	playbookBody?: string;
	researchBody?: string;
}): string {
	const name = overrides?.name ?? "obsidian";
	const extra = overrides?.extraFrontmatterLines ?? [];
	const prose = overrides?.proseBody ?? "Some prose body.\n";
	const playbook = overrides?.playbookBody ?? "Some playbook body.\n";
	const research = overrides?.researchBody ?? "Some research body.\n";

	const frontmatterLines = [
		`name: ${name}`,
		"mcpServerConfig:",
		"  command: npx",
		'  args:',
		'    - "@bitbonsai/mcpvault"',
		'    - "D:/notes/my-vault"',
		...extra,
	];

	return (
		`---\n${frontmatterLines.join("\n")}\n---\n\n` +
		`## Prose\n\n${prose}\n` +
		`## Playbook hub\n\n${playbook}\n` +
		`## Research hub\n\n${research}`
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
// 3c. Happy path — asserts on all three body fields
// ---------------------------------------------------------------------------

describe("3a — happy path", () => {
	it("returns ok with two-field config and all three body sections", async () => {
		await writeBrainAide(tempDir, CANONICAL_BRAIN_AIDE);

		const result = await parseBrainAide(tempDir);

		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return;

		expect(result.config.name).toBe("obsidian");
		expect(result.config.mcpServerConfig.command).toBe("npx");
		expect(result.config.mcpServerConfig.args).toEqual(["@bitbonsai/mcpvault", "D:/notes/my-vault"]);

		// 3c — prose: starts with the spec's sentinel phrase
		expect(result.prose).toMatch(/Your brain is an Obsidian vault\./);

		// 3c — playbookHub: verbatim bytes between ## Playbook hub heading and ## Research hub heading
		expect(result.playbookHub).toBe(extractCanonicalSection("playbookHub"));

		// 3c — researchHub: verbatim bytes between ## Research hub heading and end-of-file
		expect(result.researchHub).toBe(extractCanonicalSection("researchHub"));
	});

	it("nested # and ### headings inside sections are NOT treated as section boundaries", async () => {
		// The CANONICAL_BRAIN_AIDE fixture includes `# Coding playbook` (one hash) and
		// `### Task routing` (three hashes) inside ## Playbook hub, and `# Research` and
		// `### Domains` inside ## Research hub.  The parser must treat only `^## .+$` as a
		// boundary — if it incorrectly matched `^# ` or `^### ` the section slices would
		// be wrong and this test would fail.
		await writeBrainAide(tempDir, CANONICAL_BRAIN_AIDE);
		const result = await parseBrainAide(tempDir);

		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return;

		expect(result.playbookHub).toContain("# Coding playbook");
		expect(result.playbookHub).toContain("### Task routing");
		expect(result.researchHub).toContain("# Research");
		expect(result.researchHub).toContain("### Domains");
	});
});

// ---------------------------------------------------------------------------
// 3b. Missing file — unchanged in assertion; no body to update
// ---------------------------------------------------------------------------

describe("3b — missing file", () => {
	it("returns missing when no .aide/config/brain.aide exists — never throws", async () => {
		const result = await parseBrainAide(tempDir);

		expect(result.kind).toBe("missing");
	});
});

// ---------------------------------------------------------------------------
// 3c. Malformed YAML — body updated to three sections
// ---------------------------------------------------------------------------

describe("3c — malformed YAML frontmatter", () => {
	it("returns malformed-frontmatter with a non-empty reason for invalid YAML", async () => {
		const badYaml = `---
mcpServerConfig:
  args: [unclosed bracket
---

## Prose

Some prose.

## Playbook hub

Some playbook.

## Research hub

Some research.
`;
		await writeBrainAide(tempDir, badYaml);

		const result = await parseBrainAide(tempDir);

		expect(result.kind).toBe("malformed-frontmatter");
		if (result.kind !== "malformed-frontmatter") return;
		expect(result.reason.length).toBeGreaterThan(0);
	});
});

// ---------------------------------------------------------------------------
// 3d. Missing required field (parameterized) — bodies updated to three sections
// ---------------------------------------------------------------------------

describe("3d — missing required field", () => {
	function makeContentMissing(field: string): string {
		let frontmatterLines: string[];

		if (field === "name") {
			frontmatterLines = [
				"mcpServerConfig:",
				"  command: npx",
				'  args:',
				'    - "@bitbonsai/mcpvault"',
				'    - "D:/notes/my-vault"',
			];
		} else if (field === "mcpServerConfig.command") {
			frontmatterLines = [
				"name: obsidian",
				"mcpServerConfig:",
				'  args:',
				'    - "@bitbonsai/mcpvault"',
				'    - "D:/notes/my-vault"',
			];
		} else if (field === "mcpServerConfig.args") {
			frontmatterLines = [
				"name: obsidian",
				"mcpServerConfig:",
				"  command: npx",
			];
		} else {
			frontmatterLines = [
				"name: obsidian",
				"mcpServerConfig:",
				"  command: npx",
				'  args:',
				'    - "@bitbonsai/mcpvault"',
				'    - "D:/notes/my-vault"',
			];
		}

		return (
			`---\n${frontmatterLines.join("\n")}\n---\n\n` +
			`## Prose\n\nSome prose body.\n\n` +
			`## Playbook hub\n\nSome playbook body.\n\n` +
			`## Research hub\n\nSome research body.\n`
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
// 3d'. Deprecated-field rejection (parameterized) — bodies updated to three sections
// ---------------------------------------------------------------------------

describe("3d' — deprecated field rejection", () => {
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
		const content = (
			`---\n${frontmatter}\n---\n\n` +
			`## Prose\n\nSome prose body.\n\n` +
			`## Playbook hub\n\nSome playbook body.\n\n` +
			`## Research hub\n\nSome research body.\n`
		);

		await writeBrainAide(tempDir, content);

		const result = await parseBrainAide(tempDir);

		expect(result.kind).toBe("malformed-frontmatter");
		if (result.kind !== "malformed-frontmatter") return;
		expect(result.reason).toBe(expectedReason);
	});
});

// ---------------------------------------------------------------------------
// 3f. Missing required sections (parameterized) — replaces old "missing prose body" test
// ---------------------------------------------------------------------------

describe("3f — missing required sections (parameterized)", () => {
	// Each case: [description, headingsToInclude, expectedReason]
	// Fixtures have valid frontmatter and only the named sections present.
	const cases: Array<[string, string[], string]> = [
		[
			"missing ## Prose only",
			["## Playbook hub", "## Research hub"],
			"missing required sections: ## Prose",
		],
		[
			"missing ## Playbook hub only",
			["## Prose", "## Research hub"],
			"missing required sections: ## Playbook hub",
		],
		[
			"missing ## Research hub only",
			["## Prose", "## Playbook hub"],
			"missing required sections: ## Research hub",
		],
		[
			"missing ## Prose and ## Research hub",
			["## Playbook hub"],
			"missing required sections: ## Prose, ## Research hub",
		],
		[
			"missing all three sections",
			[],
			"missing required sections: ## Prose, ## Playbook hub, ## Research hub",
		],
	];

	it.each(cases)("%s → malformed-body with correct reason", async (_description, headingsToInclude, expectedReason) => {
		// Build a body containing only the headingsToInclude, each with a short body.
		const bodyLines: string[] = [];
		if (headingsToInclude.length === 0) {
			bodyLines.push("This body has no required headings at all.");
		} else {
			for (const h of headingsToInclude) {
				bodyLines.push(h);
				bodyLines.push("");
				bodyLines.push("Some content for this section.");
				bodyLines.push("");
			}
		}

		const content =
			`---\nname: obsidian\nmcpServerConfig:\n  command: npx\n  args:\n    - "@bitbonsai/mcpvault"\n    - "D:/notes/my-vault"\n---\n\n` +
			bodyLines.join("\n");

		await writeBrainAide(tempDir, content);

		const result = await parseBrainAide(tempDir);

		expect(result.kind).toBe("malformed-body");
		if (result.kind !== "malformed-body") return;
		// Reason must list the missing sections in REQUIRED_BODY_HEADINGS order.
		expect(result.reason).toBe(expectedReason);
	});
});

// ---------------------------------------------------------------------------
// 3g. Unknown heading rejection (parameterized)
// ---------------------------------------------------------------------------

describe("3g — unknown heading rejection", () => {
	const validFrontmatter =
		`---\nname: obsidian\nmcpServerConfig:\n  command: npx\n  args:\n    - "@bitbonsai/mcpvault"\n    - "D:/notes/my-vault"\n---\n\n`;

	// Helper to build content with the three required sections plus an extra heading at a given position.
	function withExtraHeading(position: "before" | "after" | "between", heading: string): string {
		const prose = "## Prose\n\nProse content.\n\n";
		const playbook = "## Playbook hub\n\nPlaybook content.\n\n";
		const research = "## Research hub\n\nResearch content.\n";
		const extra = `${heading}\n\nExtra content.\n\n`;

		if (position === "before") {
			return validFrontmatter + extra + prose + playbook + research;
		} else if (position === "between") {
			// Insert between ## Playbook hub and ## Research hub
			return validFrontmatter + prose + playbook + extra + research;
		} else {
			// after all three required sections
			return validFrontmatter + prose + playbook + research + "\n" + extra;
		}
	}

	it.each([
		[
			"all three required sections + ## Notes heading",
			withExtraHeading("between", "## Notes"),
			"unknown heading: ## Notes",
		],
		[
			"unknown heading BEFORE all required headings — still rejected, names the first unknown",
			withExtraHeading("before", "## Setup"),
			"unknown heading: ## Setup",
		],
		[
			"unknown heading AFTER all required headings — still rejected, names the first unknown",
			withExtraHeading("after", "## Appendix"),
			"unknown heading: ## Appendix",
		],
	])("%s → malformed-body", async (_description, content, expectedReason) => {
		await writeBrainAide(tempDir, content);

		const result = await parseBrainAide(tempDir);

		expect(result.kind).toBe("malformed-body");
		if (result.kind !== "malformed-body") return;
		expect(result.reason).toBe(expectedReason);
	});

	it("case sensitivity: ## prose (lowercase) is treated as an unknown heading", async () => {
		// The body has `## prose` (lowercase p), which is NOT a case-insensitive match for `## Prose`.
		// The walker scans left-to-right; `## prose` comes before any of the three required headings
		// in this fixture, so the unknown-heading check fires first and names it.
		// (Contract: unknown-heading rejection fires before missing-section rejection, and surfaces
		// the first unknown heading encountered left-to-right.)
		const content =
			validFrontmatter +
			`## prose\n\nLowercase heading.\n\n` +
			`## Playbook hub\n\nPlaybook.\n\n` +
			`## Research hub\n\nResearch.\n`;

		await writeBrainAide(tempDir, content);

		const result = await parseBrainAide(tempDir);

		expect(result.kind).toBe("malformed-body");
		if (result.kind !== "malformed-body") return;
		// The first unknown heading found left-to-right is `## prose`.
		expect(result.reason).toBe("unknown heading: ## prose");
	});
});

// ---------------------------------------------------------------------------
// 3h. Strict-failure migration: pre-widening prose-only brain.aide → malformed-body
// ---------------------------------------------------------------------------

describe("3h — strict-failure migration", () => {
	it("a prose-only brain.aide (pre-widening shape) returns malformed-body naming both missing sections", async () => {
		// This is a brain.aide from before the body was widened to three sections.
		// Frontmatter is valid; body has only ## Prose — no ## Playbook hub, no ## Research hub.
		const preWideningContent = `---
name: obsidian
mcpServerConfig:
  command: npx
  args:
    - "@bitbonsai/mcpvault"
    - "D:/notes/my-vault"
---

## Prose

Your brain is an Obsidian vault.
`;
		await writeBrainAide(tempDir, preWideningContent);

		const result = await parseBrainAide(tempDir);

		// The parser does NOT silently default the missing sections to empty strings.
		// It surfaces a malformed-body result naming every absent section in REQUIRED_BODY_HEADINGS order.
		expect(result.kind).toBe("malformed-body");
		if (result.kind !== "malformed-body") return;
		expect(result.reason).toBe("missing required sections: ## Playbook hub, ## Research hub");
	});
});

// ---------------------------------------------------------------------------
// 3i. Verbatim invariant extends to all three body sections (no substitution)
// ---------------------------------------------------------------------------

describe("3i — all body sections returned verbatim (no-substitution invariant)", () => {
	it("prose containing literal ${name} and ${rootPath} passes through byte-identical", async () => {
		const literalProseBody = `This is a prose body with a literal \${name} placeholder.

It also has **markdown** and a [link](https://example.com) and a wikilink [[note-name]].

The \${rootPath} value is also here for good measure.
`;
		// NOTE: the file has `## Prose\n\n<body>\n## Playbook hub...`.
		// The slicer sets startIndex just after the `## Prose\n` terminating newline, so the slice
		// starts with `\n<body>`.  extractBodySections then strips the leading `\n` from prose only
		// (backward-compat strip), leaving `<body>\n` — the extra `\n` is the blank-line separator
		// before the next heading, which the slicer includes in the slice verbatim.
		const content =
			`---\nname: obsidian\nmcpServerConfig:\n  command: npx\n  args:\n    - "@bitbonsai/mcpvault"\n    - "D:/notes/my-vault"\n---\n\n` +
			`## Prose\n\n${literalProseBody}\n` +
			`## Playbook hub\n\nPlaybook content.\n\n` +
			`## Research hub\n\nResearch content.\n`;

		await writeBrainAide(tempDir, content);

		const result = await parseBrainAide(tempDir);

		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return;
		// The prose must contain the literal ${name} unchanged — no substitution.
		expect(result.prose).toContain("${name}");
		// ${rootPath} in prose is text, not a deprecated frontmatter field — passes through.
		expect(result.prose).toContain("${rootPath}");
		expect(result.prose).toContain("**markdown**");
		expect(result.prose).toContain("[[note-name]]");
		// Full byte-identity: the prose starts with the body text (leading \n stripped) and ends
		// with the blank-line separator before ## Playbook hub, which the slicer includes verbatim.
		expect(result.prose).toBe(literalProseBody + "\n");
	});

	it("## Playbook hub containing literal ${name} passes through byte-identical", async () => {
		const playbookBody = `This playbook section contains \${name} literally.

The \${name} placeholder should not be substituted here.
`;
		const content =
			`---\nname: my-vault\nmcpServerConfig:\n  command: npx\n  args:\n    - "@bitbonsai/mcpvault"\n    - "D:/notes/my-vault"\n---\n\n` +
			`## Prose\n\nSome prose.\n\n` +
			`## Playbook hub\n\n${playbookBody}\n` +
			`## Research hub\n\nSome research.\n`;

		await writeBrainAide(tempDir, content);

		const result = await parseBrainAide(tempDir);

		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return;
		// The playbook hub must contain the literal ${name} unchanged.
		expect(result.playbookHub).toContain("${name}");
		// Substitution only runs on mcpServerConfig.args — not on any body section.
		expect(result.playbookHub).not.toContain("my-vault");
	});

	it("## Research hub containing literal ${name} passes through byte-identical", async () => {
		const researchBody = `This research section contains \${name} literally.

The \${name} placeholder should not be substituted here either.
`;
		const content =
			`---\nname: my-vault\nmcpServerConfig:\n  command: npx\n  args:\n    - "@bitbonsai/mcpvault"\n    - "D:/notes/my-vault"\n---\n\n` +
			`## Prose\n\nSome prose.\n\n` +
			`## Playbook hub\n\nSome playbook.\n\n` +
			`## Research hub\n\n${researchBody}`;

		await writeBrainAide(tempDir, content);

		const result = await parseBrainAide(tempDir);

		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return;
		// The research hub must contain the literal ${name} unchanged.
		expect(result.researchHub).toContain("${name}");
		// Substitution only runs on mcpServerConfig.args — not on any body section.
		expect(result.researchHub).not.toContain("my-vault");
	});
});

// ---------------------------------------------------------------------------
// 3j. Name is metadata, not dispatched on — fixtures updated to three sections
// ---------------------------------------------------------------------------

describe("3j — name is metadata, not dispatched on", () => {
	function makeContentWithName(name: string): string {
		return (
			`---\nname: ${name}\nmcpServerConfig:\n  command: npx\n  args:\n    - "@bitbonsai/mcpvault"\n    - "D:/notes/my-vault"\n---\n\n` +
			`## Prose\n\nProse body for ${name} brain.\n\n` +
			`## Playbook hub\n\nPlaybook body for ${name} brain.\n\n` +
			`## Research hub\n\nResearch body for ${name} brain.\n`
		);
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

			// Both have the same shape — only name value and body content differ.
			expect(obsidianResult.config.name).toBe("obsidian");
			expect(notionResult.config.name).toBe("notion");

			// mcpServerConfig is identical — name did not influence it.
			expect(obsidianResult.config.mcpServerConfig).toEqual(notionResult.config.mcpServerConfig);

			// Both prose bodies pass through verbatim (no name-based rewriting).
			// The slicer strips the single \n immediately after ## Prose, then preserves everything
			// through the blank-line separator before ## Playbook hub (inclusive).
			expect(obsidianResult.prose).toBe("Prose body for obsidian brain.\n\n");
			expect(notionResult.prose).toBe("Prose body for notion brain.\n\n");
		} finally {
			await rm(obsidianDir, { recursive: true, force: true });
			await rm(notionDir, { recursive: true, force: true });
		}
	});
});

// ---------------------------------------------------------------------------
// 3k. interpolateArgs — canonical config is a no-op
// ---------------------------------------------------------------------------

describe("3k — interpolateArgs canonical config is a no-op", () => {
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
// 3k'. interpolateArgs is positional (string replacement, not arg replacement)
// ---------------------------------------------------------------------------

describe("3k' — interpolateArgs is positional", () => {
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
// 3k''. interpolateArgs does not touch any body section
// ---------------------------------------------------------------------------

describe("3k'' — interpolateArgs does not touch the body sections", () => {
	it("interpolateArgs takes only config — it has no path that receives any body section", async () => {
		await writeBrainAide(tempDir, CANONICAL_BRAIN_AIDE);
		const parseResult = await parseBrainAide(tempDir);

		expect(parseResult.kind).toBe("ok");
		if (parseResult.kind !== "ok") return;

		const proseBeforeInterpolation = parseResult.prose;
		const playbookBeforeInterpolation = parseResult.playbookHub;
		const researchBeforeInterpolation = parseResult.researchHub;

		// interpolateArgs only accepts config — body sections are structurally excluded from its signature.
		const interpolated = interpolateArgs(parseResult.config);

		// Calling interpolateArgs did not affect any body string.
		expect(parseResult.prose).toBe(proseBeforeInterpolation);
		expect(parseResult.playbookHub).toBe(playbookBeforeInterpolation);
		expect(parseResult.researchHub).toBe(researchBeforeInterpolation);
		// The interpolated result is the args array — no body strings in the return value.
		expect(Array.isArray(interpolated)).toBe(true);
		expect(interpolated).not.toContain(proseBeforeInterpolation);
	});
});

// ---------------------------------------------------------------------------
// 3l. parseBrainAideFromString parses bytes identically to parseBrainAide
//     Fixtures updated to three-section bodies; noProseContent → noPlaybookHubContent
// ---------------------------------------------------------------------------

describe("3l — parseBrainAideFromString parses bytes identically to parseBrainAide from disk", () => {
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

## Playbook hub

Playbook.

## Research hub

Research.
`;
		await writeBrainAide(tempDir, badYaml);

		const fromDisk = await parseBrainAide(tempDir);
		const fromString = parseBrainAideFromString(badYaml);

		expect(fromDisk.kind).toBe("malformed-frontmatter");
		expect(fromString.kind).toBe("malformed-frontmatter");
		expect(fromDisk).toEqual(fromString);
	});

	it("malformed-body — missing ## Playbook hub heading parses identically via both paths", async () => {
		// This replaces the legacy noProseContent fixture. The body has ## Prose and ## Research hub
		// but is missing ## Playbook hub — proving that malformed-body reaches identically through
		// the disk and string paths for any missing required section, not just ## Prose.
		const noPlaybookHubContent = `---
name: obsidian
mcpServerConfig:
  command: npx
  args:
    - "@bitbonsai/mcpvault"
    - "D:/notes/my-vault"
---

## Prose

Some prose.

## Research hub

Some research.
`;
		await writeBrainAide(tempDir, noPlaybookHubContent);

		const fromDisk = await parseBrainAide(tempDir);
		const fromString = parseBrainAideFromString(noPlaybookHubContent);

		expect(fromDisk.kind).toBe("malformed-body");
		expect(fromString.kind).toBe("malformed-body");
		if (fromDisk.kind !== "malformed-body" || fromString.kind !== "malformed-body") return;
		// Both paths return the same reason naming the missing section.
		expect(fromDisk.reason).toBe("missing required sections: ## Playbook hub");
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
// 3m. Per-section ownership: result.config does NOT contain prose, playbookHub, researchHub
// ---------------------------------------------------------------------------

describe("3m — per-section ownership: body fields are siblings of config, not properties of it", () => {
	it("result.config does not contain prose, playbookHub, or researchHub", async () => {
		await writeBrainAide(tempDir, CANONICAL_BRAIN_AIDE);

		const result = await parseBrainAide(tempDir);

		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return;

		// Documents the type boundary: body sections are siblings on the ok variant,
		// NOT properties of config. A consumer that does `result.config.prose` is reaching
		// into the wrong nesting level — this test makes that contract visible so a future
		// refactor that moves body sections into config will fail visibly.
		expect(Object.prototype.hasOwnProperty.call(result.config, "prose")).toBe(false);
		expect(Object.prototype.hasOwnProperty.call(result.config, "playbookHub")).toBe(false);
		expect(Object.prototype.hasOwnProperty.call(result.config, "researchHub")).toBe(false);

		// Verify the body fields ARE present on result (siblings of config, not nested under it).
		expect(typeof result.prose).toBe("string");
		expect(typeof result.playbookHub).toBe("string");
		expect(typeof result.researchHub).toBe("string");
	});
});
