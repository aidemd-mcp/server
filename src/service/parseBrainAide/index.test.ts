import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import parseBrainAide, { parseBrainAideFromString, interpolateArgs } from "./index.js";
import brainContract from "@/service/brainContract/index.js";
import toMarkerPair from "@/service/brainContract/toMarkerPair/index.js";
import type { BrainAideConfig, BrainSectionField, BrainSectionMarker } from "@/types/index.js";

// ---------------------------------------------------------------------------
// Contract-derived fixtures.
//
// Every valid body in this file is produced by `makeBody`, which maps the
// published `brainContract` through `toMarkerPair`. No test restates the
// required-section list or the marker bytes, so fixtures stay in step with any
// future contract growth. Tests that need a structurally broken body use the
// factory's `omit`, `order`, and `tokens` options to damage a valid body in
// exactly one way.
// ---------------------------------------------------------------------------

const contractMarkers: BrainSectionMarker[] = brainContract.map(({ marker }) => marker);

function fieldOf(marker: BrainSectionMarker): BrainSectionField {
	return brainContract.find((entry) => entry.marker === marker)!.field;
}

function open(marker: BrainSectionMarker): string {
	return toMarkerPair(marker).open;
}

function close(marker: BrainSectionMarker): string {
	return toMarkerPair(marker).close;
}

/** The default body bytes of a section (the part between its closer and the newline after its opener). */
function defaultContent(marker: BrainSectionMarker): string {
	return `Some ${marker} content.\n`;
}

type TokenOverride = { open?: string | null; close?: string | null };

type BodyOptions = {
	/** Section content keyed by marker; defaults to a one-line placeholder. Must end with a newline to keep the closer on its own line. */
	content?: Partial<Record<BrainSectionMarker, string>>;
	/** Markers whose whole pair is left out of the body. */
	omit?: BrainSectionMarker[];
	/** Document order of the present sections; defaults to contract order. */
	order?: BrainSectionMarker[];
	/** Replace a section's opener or closer text, or drop it entirely with null. */
	tokens?: Partial<Record<BrainSectionMarker, TokenOverride>>;
};

function makeBlock(marker: BrainSectionMarker, options: BodyOptions = {}): string {
	const content = options.content?.[marker] ?? defaultContent(marker);
	const openToken = options.tokens?.[marker]?.open === undefined ? open(marker) : options.tokens[marker]!.open;
	const closeToken = options.tokens?.[marker]?.close === undefined ? close(marker) : options.tokens[marker]!.close;
	return `${openToken === null ? "" : `${openToken}\n`}${content}${closeToken === null ? "" : closeToken}`;
}

/** Build a body of sections, one block per present marker, separated by blank lines. */
function makeBody(options: BodyOptions = {}): string {
	const omitted = new Set(options.omit ?? []);
	const order = (options.order ?? contractMarkers).filter((marker) => !omitted.has(marker));
	return order.map((marker) => makeBlock(marker, options)).join("\n\n") + "\n";
}

/** Contract order with `moved` placed immediately before `target`. */
function reorder(moved: BrainSectionMarker, target: BrainSectionMarker): BrainSectionMarker[] {
	const rest = contractMarkers.filter((marker) => marker !== moved);
	rest.splice(rest.indexOf(target), 0, moved);
	return rest;
}

type FrontmatterOptions = {
	name?: string;
	command?: string;
	argsLines?: string[];
	extraLines?: string[];
};

const DEFAULT_ARGS_LINES = ['    - "@example/mcp-launcher"', '    - "D:/brains/my-brain"'];

/**
 * Build the frontmatter block (including closing fence and trailing blank line).
 * `argsLines` replaces the default two-element args block; each element must be
 * an indented YAML line such as `    - value` (or bare `    -` for a YAML null).
 */
function makeFrontmatter(options: FrontmatterOptions = {}): string {
	const lines = [
		`name: ${options.name ?? "my-brain"}`,
		"mcpServerConfig:",
		`  command: ${options.command ?? "npx"}`,
		"  args:",
		...(options.argsLines ?? DEFAULT_ARGS_LINES),
		...(options.extraLines ?? []),
	];
	return `---\n${lines.join("\n")}\n---\n\n`;
}

/** A complete valid brain.aide: frontmatter plus a contract-derived body. */
function makeContent(options: FrontmatterOptions & BodyOptions = {}): string {
	return makeFrontmatter(options) + makeBody(options);
}

// ---------------------------------------------------------------------------
// Shared canonical fixture: every contract section with non-trivial content.
//
// Exercises markdown the parser must NOT interpret (literal `#` headings and
// `${name}`-shaped placeholders), and a note-to-self ABOVE the first opener so
// bytes-outside-pairs silent-ignore is observed end-to-end on the happy path.
// ---------------------------------------------------------------------------

const CANONICAL_CONTENT: Record<BrainSectionMarker, string> = {
	orientation: `Your brain is an external knowledge store reached through MCP tools.
Use the read-note tool to open files by their brain-root-relative
path. Use the search-notes tool for keyword queries across the
brain. The brain's entry file is \`CLAUDE.md\` at the brain root — read
that first; it lists the inline references your task may need.
`,
	config: `This brain is wired through an MCP server that exposes read and search
tools. The MCP server is configured in \`mcpServerConfig\` above with the
command and arguments needed to launch it.
`,
	"playbook-index": `# Coding playbook

An entry point for coding conventions, patterns, and architecture
decisions. Read this index first, then drill into the section that
matches your task.

## Task routing

| Task type | Read first |
| --------- | ---------- |
| Naming    | Foundations |

### Sections

(Add sections here as your playbook grows. Each section reference
uses a path like \${name}/section-name for advanced templating.)
`,
	"study-playbook": `# Study playbook

Start at the playbook hub — it lists every section with a one-line
description. Match your task domain to the description, then open
only that section's hub.
`,
	"update-playbook": `When a coding pattern changes or a new convention is established,
update the playbook so the next agent session benefits from it.
`,
	"research-index": `# Research

An entry point for domain research material.

## Domains

### Example domain

A \${name} placeholder here proves verbatim pass-through in the
research section.
`,
	"kanban-board": `# Board

## Backlog

## Done
`,
	"work-kanban": `# Working the board

Create, work, manage, move, complete, stash and review cards.
`,
};

const CANONICAL_PREAMBLE = `A note-to-self above the first opener — silently ignored by the
parser; the user can keep scratch text here without warning.

`;

const CANONICAL_BRAIN_AIDE = makeFrontmatter() + CANONICAL_PREAMBLE + makeBody({ content: CANONICAL_CONTENT });

const CANONICAL_CONFIG: BrainAideConfig = {
	name: "my-brain",
	mcpServerConfig: {
		command: "npx",
		args: ["@example/mcp-launcher", "D:/brains/my-brain"],
	},
};

/**
 * Independent oracle: the bytes strictly between a section's markers in the
 * canonical fixture, found by plain indexOf over the body the parser sees
 * (frontmatter dropped, one leading newline stripped).
 */
function extractCanonicalSection(field: BrainSectionField): string {
	const afterOpen = CANONICAL_BRAIN_AIDE.trimStart().slice(3);
	const closeIndex = afterOpen.indexOf("\n---");
	const body = afterOpen.slice(closeIndex + 4).replace(/^\n/, "");

	const { marker } = brainContract.find((entry) => entry.field === field)!;
	const { open: opener, close: closer } = toMarkerPair(marker);

	return body.slice(body.indexOf(opener) + opener.length, body.indexOf(closer));
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function writeBrainAide(root: string, content: string): Promise<void> {
	await mkdir(join(root, ".aide", "config"), { recursive: true });
	await writeFile(join(root, ".aide", "config", "brain.aide"), content, "utf-8");
}

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
	it("returns ok with flattened frontmatter fields and one body field per contract entry", async () => {
		await writeBrainAide(tempDir, CANONICAL_BRAIN_AIDE);

		const result = await parseBrainAide(tempDir);

		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return;

		expect(result.name).toBe("my-brain");
		expect(result.mcpServerConfig.command).toBe("npx");
		expect(result.mcpServerConfig.args).toEqual(["@example/mcp-launcher", "D:/brains/my-brain"]);

		for (const { field } of brainContract) {
			expect(result[field]).toBe(extractCanonicalSection(field));
		}
		expect(result.orientation).toMatch(/Your brain is an external knowledge store/);
		expect(result.studyPlaybook).toMatch(/Start at the playbook hub/);
	});

	it("ok result carries exactly one field per contract entry, each byte-identical to the bytes between its markers (verbatim, no trim)", async () => {
		const content: Partial<Record<BrainSectionMarker, string>> = Object.fromEntries(
			contractMarkers.map((marker) => [marker, `  \t leading and trailing whitespace for ${marker}  \n\n\n`]),
		);
		await writeBrainAide(tempDir, makeContent({ content }));

		const result = await parseBrainAide(tempDir);

		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return;

		const fieldKeys = Object.keys(result).filter((key) => key !== "kind" && key !== "name" && key !== "mcpServerConfig");
		expect(fieldKeys.sort()).toEqual(brainContract.map(({ field }) => field).sort());

		for (const marker of contractMarkers) {
			expect(result[fieldOf(marker)]).toBe(`\n${content[marker]}`);
		}
	});

	it("literal # H1 and ## headings inside sections pass through verbatim — marker grammar is bytes not lines", async () => {
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
		expect(result.kanbanBoard).toContain("## Backlog");
	});
});

// ---------------------------------------------------------------------------
// 3b. Missing file
// ---------------------------------------------------------------------------

describe("3b — missing file", () => {
	it("returns missing when no .aide/config/brain.aide exists — never throws", async () => {
		const result = await parseBrainAide(tempDir);

		expect(result.kind).toBe("missing");
	});

	it("returns unreadable, not missing, naming the read error when brain.aide exists but cannot be read (a directory at the path)", async () => {
		await mkdir(join(tempDir, ".aide", "config", "brain.aide"), { recursive: true });

		const result = await parseBrainAide(tempDir);

		expect(result.kind).toBe("unreadable");
		if (result.kind !== "unreadable") return;
		expect(result.reason).toBe("cannot read .aide/config/brain.aide: path is a directory (EISDIR)");
	});
});

// ---------------------------------------------------------------------------
// 3c. Malformed YAML
// ---------------------------------------------------------------------------

describe("3c — malformed YAML frontmatter", () => {
	it("returns malformed-frontmatter with a non-empty reason for invalid YAML", async () => {
		const badYaml = `---\nmcpServerConfig:\n  args: [unclosed bracket\n---\n\n` + makeBody();
		await writeBrainAide(tempDir, badYaml);

		const result = await parseBrainAide(tempDir);

		expect(result.kind).toBe("malformed-frontmatter");
		if (result.kind !== "malformed-frontmatter") return;
		expect(result.reason.length).toBeGreaterThan(0);
	});
});

// ---------------------------------------------------------------------------
// 3d. Missing required frontmatter field (parameterized)
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
		} else {
			frontmatterLines = ["name: my-brain", "mcpServerConfig:", "  command: npx"];
		}

		return `---\n${frontmatterLines.join("\n")}\n---\n\n` + makeBody();
	}

	it.each(["name", "mcpServerConfig.command", "mcpServerConfig.args"])(
		"missing %s → malformed-frontmatter with reason mentioning the field",
		async (field) => {
			await writeBrainAide(tempDir, makeContentMissing(field));

			const result = await parseBrainAide(tempDir);

			expect(result.kind).toBe("malformed-frontmatter");
			if (result.kind !== "malformed-frontmatter") return;
			expect(result.reason).toContain(field);
		},
	);
});

// ---------------------------------------------------------------------------
// 3d'. Deprecated-field rejection (parameterized)
// ---------------------------------------------------------------------------

describe("3d' — deprecated field rejection", () => {
	const cases: Array<[description: string, extraLines: string[], expectedReason: string]> = [
		["single deprecated field: connector", ["connector: some-backend"], "deprecated fields: connector"],
		["single deprecated field: rootPath", ["rootPath: D:/brains/my-brain"], "deprecated fields: rootPath"],
		["single deprecated field: entryFile", ["entryFile: CLAUDE.md"], "deprecated fields: entryFile"],
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
		await writeBrainAide(tempDir, makeContent({ extraLines }));

		const result = await parseBrainAide(tempDir);

		expect(result.kind).toBe("malformed-frontmatter");
		if (result.kind !== "malformed-frontmatter") return;
		expect(result.reason).toBe(expectedReason);
	});
});

// ---------------------------------------------------------------------------
// 3e. Missing required sections — wholly absent pairs come back as
// `missing-sections`, never as a malformed body and never defaulted.
// ---------------------------------------------------------------------------

describe("3e — missing required sections", () => {
	const omitCases: Array<[description: string, omit: BrainSectionMarker[]]> = [
		["missing orientation only", ["orientation"]],
		["missing config only", ["config"]],
		["missing playbook-index only", ["playbook-index"]],
		["missing study-playbook only", ["study-playbook"]],
		["missing update-playbook only", ["update-playbook"]],
		["missing research-index only", ["research-index"]],
		["missing kanban-board only", ["kanban-board"]],
		["missing work-kanban only", ["work-kanban"]],
		["missing orientation and research-index", ["orientation", "research-index"]],
		["missing orientation and playbook-index", ["orientation", "playbook-index"]],
		["missing study-playbook and research-index", ["study-playbook", "research-index"]],
		["missing kanban-board and work-kanban", ["kanban-board", "work-kanban"]],
	];

	it.each(omitCases)("%s → missing-sections naming exactly the absent markers", async (_description, omit) => {
		await writeBrainAide(tempDir, makeContent({ omit }));

		const result = await parseBrainAide(tempDir);

		expect(result.kind).toBe("missing-sections");
		if (result.kind !== "missing-sections") return;
		expect(result.sections).toEqual(omit);
	});

	it("a file missing only kanban-board and work-kanban returns missing-sections with exactly [\"kanban-board\",\"work-kanban\"]", async () => {
		await writeBrainAide(tempDir, makeContent({ omit: ["kanban-board", "work-kanban"] }));

		const result = await parseBrainAide(tempDir);

		expect(result).toEqual({ kind: "missing-sections", sections: ["kanban-board", "work-kanban"] });
	});

	it("a file missing non-adjacent sections lists every missing marker in contract order, regardless of omission order", async () => {
		await writeBrainAide(tempDir, makeContent({ omit: ["work-kanban", "config", "research-index"] }));

		const result = await parseBrainAide(tempDir);

		expect(result.kind).toBe("missing-sections");
		if (result.kind !== "missing-sections") return;
		expect(result.sections).toEqual(["config", "research-index", "work-kanban"]);
	});

	it("a missing section is never defaulted — the result is not ok and carries no field for the absent section", async () => {
		await writeBrainAide(tempDir, makeContent({ omit: ["kanban-board"] }));

		const result = await parseBrainAide(tempDir);

		expect(result.kind).not.toBe("ok");
		expect(Object.keys(result)).not.toContain("kanbanBoard");
		expect(Object.values(result)).not.toContain("");
	});

	it("an empty file body (frontmatter only) is missing every contract section", async () => {
		await writeBrainAide(tempDir, makeFrontmatter());

		const result = await parseBrainAide(tempDir);

		expect(result).toEqual({ kind: "missing-sections", sections: contractMarkers });
	});

	// Structural precedence: faults among present sections are reported before absence,
	// so `missing-sections` guarantees the present sections are sound.

	it("structural precedence: one half-present pair AND one wholly absent pair returns malformed-body (unmatched), not missing-sections", async () => {
		await writeBrainAide(
			tempDir,
			makeContent({ omit: ["research-index"], tokens: { orientation: { close: null } } }),
		);

		const result = await parseBrainAide(tempDir);

		expect(result.kind).toBe("malformed-body");
		if (result.kind !== "malformed-body") return;
		expect(result.reason).toBe(
			`unmatched opening marker: ${open("orientation")} has no matching ${close("orientation")}`,
		);
	});

	it("an order violation among the present pairs with others absent returns malformed-body (order), not missing-sections", async () => {
		await writeBrainAide(
			tempDir,
			makeContent({ omit: ["kanban-board", "work-kanban"], order: reorder("config", "orientation") }),
		);

		const result = await parseBrainAide(tempDir);

		expect(result.kind).toBe("malformed-body");
		if (result.kind !== "malformed-body") return;
		expect(result.reason).toBe(`marker order violation: ${open("config")} appeared before ${open("orientation")}`);
	});

	it("a nesting fault among the present pairs with others absent returns malformed-body (nested), not missing-sections", async () => {
		const body =
			makeBlock("orientation") +
			"\n\n" +
			`${open("config")}\nSome config content.\n${makeBlock("playbook-index")}\n${close("config")}\n`;
		await writeBrainAide(tempDir, makeFrontmatter() + body);

		const result = await parseBrainAide(tempDir);

		expect(result.kind).toBe("malformed-body");
		if (result.kind !== "malformed-body") return;
		expect(result.reason).toBe(`nested marker: ${open("playbook-index")} appeared inside the config section`);
	});

	// Unmatched pairs, one opener-only and one closer-only case at two contract positions.

	it.each<[BrainSectionMarker]>([["orientation"], ["study-playbook"], ["work-kanban"]])(
		"%s opener present but closer missing → unmatched opening marker",
		async (marker) => {
			await writeBrainAide(tempDir, makeContent({ tokens: { [marker]: { close: null } } }));

			const result = await parseBrainAide(tempDir);

			expect(result.kind).toBe("malformed-body");
			if (result.kind !== "malformed-body") return;
			expect(result.reason).toBe(`unmatched opening marker: ${open(marker)} has no matching ${close(marker)}`);
		},
	);

	it.each<[BrainSectionMarker]>([["orientation"], ["study-playbook"], ["work-kanban"]])(
		"%s closer present but opener missing → unmatched closing marker",
		async (marker) => {
			await writeBrainAide(tempDir, makeContent({ tokens: { [marker]: { open: null } } }));

			const result = await parseBrainAide(tempDir);

			expect(result.kind).toBe("malformed-body");
			if (result.kind !== "malformed-body") return;
			expect(result.reason).toBe(
				`unmatched closing marker: ${close(marker)} appeared without a prior ${open(marker)}`,
			);
		},
	);
});

// ---------------------------------------------------------------------------
// 3f. Malformed / typo'd marker rejection.
//
// One recognized marker is replaced by a malformed variant; everything else is
// a valid contract-derived body. The reason names the offending token exactly
// as written.
// ---------------------------------------------------------------------------

describe("3f — malformed/typo'd marker rejection", () => {
	const malformedCases: Array<[description: string, marker: BrainSectionMarker, side: "open" | "close", token: string]> = [
		["uppercase variant", "orientation", "open", "<!-- AIDE-ORIENTATION-START -->"],
		["mixed-case variant", "orientation", "open", "<!-- Aide-orientation-start -->"],
		["no surrounding spaces", "orientation", "open", "<!--aide-orientation-start-->"],
		["extra internal whitespace (trailing)", "orientation", "open", "<!-- aide-orientation-start  -->"],
		["extra internal whitespace (leading)", "orientation", "open", "<!--  aide-orientation-start -->"],
		["missing aide- prefix", "orientation", "open", "<!-- orientation-start -->"],
		["typo in token (strart)", "orientation", "open", "<!-- aide-orientation-strart -->"],
		["typo in section name (playbook-iindex)", "playbook-index", "open", "<!-- aide-playbook-iindex-start -->"],
		["typo in study-playbook section name (study-pllaybook)", "study-playbook", "open", "<!-- aide-study-pllaybook-start -->"],
		["uppercase variant of study-playbook opener", "study-playbook", "open", "<!-- AIDE-STUDY-PLAYBOOK-START -->"],
		["uppercase config-start", "config", "open", "<!-- AIDE-CONFIG-START -->"],
		["typo in config-end", "config", "close", "<!-- aide-config-ennd -->"],
		["typo in update-playbook-start", "update-playbook", "open", "<!-- aide-update-playbook-strart -->"],
		["uppercase update-playbook-end", "update-playbook", "close", "<!-- AIDE-UPDATE-PLAYBOOK-END -->"],
		["typo in kanban-board section name (bord)", "kanban-board", "open", "<!-- aide-kanban-bord-start -->"],
		["uppercase work-kanban closer", "work-kanban", "close", "<!-- AIDE-WORK-KANBAN-END -->"],
	];

	it.each(malformedCases)("%s → malformed-body with unknown marker reason", async (_description, marker, side, token) => {
		await writeBrainAide(tempDir, makeContent({ tokens: { [marker]: { [side]: token } } }));

		const result = await parseBrainAide(tempDir);

		expect(result.kind).toBe("malformed-body");
		if (result.kind !== "malformed-body") return;
		expect(result.reason).toBe(`unknown marker: ${token}`);
	});

	it("an unknown-marker typo on a new marker name is flagged as unknown marker even when other sections are absent", async () => {
		await writeBrainAide(
			tempDir,
			makeContent({ omit: ["work-kanban"], tokens: { "kanban-board": { open: "<!-- aide-kanban-bord-start -->" } } }),
		);

		const result = await parseBrainAide(tempDir);

		expect(result.kind).toBe("malformed-body");
		if (result.kind !== "malformed-body") return;
		expect(result.reason).toBe("unknown marker: <!-- aide-kanban-bord-start -->");
	});

	it("left-to-right ordering: two malformed markers — reason names the FIRST encountered", async () => {
		await writeBrainAide(
			tempDir,
			makeContent({
				tokens: {
					orientation: { open: "<!-- AIDE-ORIENTATION-START -->" },
					config: { open: "<!-- Aide-config-start -->" },
				},
			}),
		);

		const result = await parseBrainAide(tempDir);

		expect(result.kind).toBe("malformed-body");
		if (result.kind !== "malformed-body") return;
		expect(result.reason).toBe("unknown marker: <!-- AIDE-ORIENTATION-START -->");
	});
});

// ---------------------------------------------------------------------------
// 3g. Marker order violation — every section present and paired; only the
// order is wrong. The reason names the two openers in the order they appear.
// ---------------------------------------------------------------------------

describe("3g — marker order violation", () => {
	const orderCases: Array<[description: string, moved: BrainSectionMarker, target: BrainSectionMarker]> = [
		["config before orientation", "config", "orientation"],
		["research-index before playbook-index", "research-index", "playbook-index"],
		["research-index first (before orientation)", "research-index", "orientation"],
		["study-playbook before playbook-index", "study-playbook", "playbook-index"],
		["research-index before study-playbook", "research-index", "study-playbook"],
		["update-playbook before study-playbook", "update-playbook", "study-playbook"],
		["work-kanban before kanban-board", "work-kanban", "kanban-board"],
		["kanban-board before research-index", "kanban-board", "research-index"],
		["playbook-index before config", "playbook-index", "config"],
	];

	it.each(orderCases)("%s → malformed-body", async (_description, moved, target) => {
		const order = reorder(moved, target);
		await writeBrainAide(tempDir, makeContent({ order }));

		const result = await parseBrainAide(tempDir);

		// The first adjacent pair of openers, in document order, that disagrees with contract order.
		const violatedAt = order.findIndex((marker, i) => i < order.length - 1 && contractMarkers.indexOf(marker) > contractMarkers.indexOf(order[i + 1]!));

		expect(result.kind).toBe("malformed-body");
		if (result.kind !== "malformed-body") return;
		expect(result.reason).toBe(
			`marker order violation: ${open(order[violatedAt]!)} appeared before ${open(order[violatedAt + 1]!)}`,
		);
	});

	it("config before orientation names exactly those two openers", async () => {
		await writeBrainAide(tempDir, makeContent({ order: reorder("config", "orientation") }));

		const result = await parseBrainAide(tempDir);

		expect(result.kind).toBe("malformed-body");
		if (result.kind !== "malformed-body") return;
		expect(result.reason).toBe(`marker order violation: ${open("config")} appeared before ${open("orientation")}`);
	});
});

// ---------------------------------------------------------------------------
// 3h. Nested marker rejection — every marker present and well-formed; only the
// byte offsets put a marker (or pair) inside another pair's span.
// ---------------------------------------------------------------------------

describe("3h — nested marker rejection", () => {
	/** Blocks of every section strictly before `marker` in contract order. */
	function blocksBefore(marker: BrainSectionMarker): string[] {
		return contractMarkers.slice(0, contractMarkers.indexOf(marker)).map((m) => makeBlock(m));
	}

	/** Blocks of every section strictly after `marker` in contract order. */
	function blocksAfter(marker: BrainSectionMarker): string[] {
		return contractMarkers.slice(contractMarkers.indexOf(marker) + 1).map((m) => makeBlock(m));
	}

	/** Join pieces with blank lines and end with a newline. */
	function join(...parts: string[]): string {
		return parts.join("\n\n") + "\n";
	}

	const nestingCases: Array<[description: string, body: string, expectedReason: string]> = [
		[
			"playbook-index pair nested inside config pair",
			// Openers still appear in contract order, so the order check passes and the nesting check fires.
			join(
				...blocksBefore("config"),
				`${open("config")}\nSome config content.\n${makeBlock("playbook-index")}\nMore config content.\n${close("config")}`,
				...blocksAfter("playbook-index"),
			),
			`nested marker: ${open("playbook-index")} appeared inside the config section`,
		],
		[
			"config-start nested inside orientation pair",
			join(
				`${open("orientation")}\nSome orientation content.\n${open("config")}\nMore orientation content.\n${close("orientation")}`,
				close("config"),
				...blocksAfter("config"),
			),
			`nested marker: ${open("config")} appeared inside the orientation section`,
		],
		[
			"update-playbook pair nested inside study-playbook pair",
			join(
				...blocksBefore("study-playbook"),
				`${open("study-playbook")}\nSome study playbook content.\n${makeBlock("update-playbook")}\nMore study playbook content.\n${close("study-playbook")}`,
				...blocksAfter("update-playbook"),
			),
			`nested marker: ${open("update-playbook")} appeared inside the studyPlaybook section`,
		],
		[
			"stray playbook-index closer inside research-index pair",
			// Every real pair is present and in order; the duplicate closer sits inside research-index's span.
			join(
				...blocksBefore("research-index"),
				`${open("research-index")}\nSome research content.\n${close("playbook-index")}\nMore research.\n${close("research-index")}`,
				...blocksAfter("research-index"),
			),
			`nested marker: ${close("playbook-index")} appeared inside the researchIndex section`,
		],
		[
			"single stray inner opener (no full inner pair) inside a pair",
			join(
				`${open("orientation")}\nSome orientation content.\n${open("config")}\nStray opener, no matching closer inside orientation.\n${close("orientation")}`,
				close("config"),
				...blocksAfter("config"),
			),
			`nested marker: ${open("config")} appeared inside the orientation section`,
		],
		[
			"study-playbook pair nested inside playbook-index pair",
			join(
				...blocksBefore("playbook-index"),
				`${open("playbook-index")}\nSome playbook index content.\n${makeBlock("study-playbook")}\nMore playbook index content.\n${close("playbook-index")}`,
				...blocksAfter("study-playbook"),
			),
			`nested marker: ${open("study-playbook")} appeared inside the playbookIndex section`,
		],
		[
			"work-kanban pair nested inside kanban-board pair",
			join(
				...blocksBefore("kanban-board"),
				`${open("kanban-board")}\nSome board content.\n${makeBlock("work-kanban")}\nMore board content.\n${close("kanban-board")}`,
			),
			`nested marker: ${open("work-kanban")} appeared inside the kanbanBoard section`,
		],
	];

	it.each(nestingCases)("%s → malformed-body", async (_description, body, expectedReason) => {
		await writeBrainAide(tempDir, makeFrontmatter() + body);

		const result = await parseBrainAide(tempDir);

		expect(result.kind).toBe("malformed-body");
		if (result.kind !== "malformed-body") return;
		expect(result.reason).toBe(expectedReason);
	});
});

// ---------------------------------------------------------------------------
// 3i. Pre-rework files carrying retired vocabulary hold no current section, so
// they come back as `missing-sections` listing every absent contract marker —
// never defaulted, never auto-detected, never an unknown-marker fault.
// ---------------------------------------------------------------------------

describe("3i — strict-failure migration: pre-rework bodies", () => {
	it("heading-based body with no marker pairs returns missing-sections naming every contract marker", async () => {
		const headingBody = `## Prose

Your brain is an external knowledge store.

## Playbook

An entry point for coding conventions.

## Research

An entry point for domain research.
`;
		await writeBrainAide(tempDir, makeFrontmatter() + headingBody);

		const result = await parseBrainAide(tempDir);

		expect(result).toEqual({ kind: "missing-sections", sections: contractMarkers });
	});

	it("three-pair marker-bounded body (retired prose + playbook + research markers) returns missing-sections naming every contract marker", async () => {
		const threePairBody =
			`<!-- aide-prose-start -->\nSome prose content.\n<!-- aide-prose-end -->\n\n` +
			`<!-- aide-playbook-start -->\nSome playbook content.\n<!-- aide-playbook-end -->\n\n` +
			`<!-- aide-research-start -->\nSome research content.\n<!-- aide-research-end -->\n`;
		await writeBrainAide(tempDir, makeFrontmatter() + threePairBody);

		const result = await parseBrainAide(tempDir);

		expect(result).toEqual({ kind: "missing-sections", sections: contractMarkers });
	});

	it("four-pair pre-rework body keeps its study-playbook pair and lists every other contract marker as missing", async () => {
		const fourPairBody =
			`<!-- aide-prose-start -->\nSome prose content.\n<!-- aide-prose-end -->\n\n` +
			`<!-- aide-playbook-start -->\nSome playbook content.\n<!-- aide-playbook-end -->\n\n` +
			`${makeBlock("study-playbook")}\n\n` +
			`<!-- aide-research-start -->\nSome research content.\n<!-- aide-research-end -->\n`;
		await writeBrainAide(tempDir, makeFrontmatter() + fourPairBody);

		const result = await parseBrainAide(tempDir);

		expect(result).toEqual({
			kind: "missing-sections",
			sections: contractMarkers.filter((marker) => marker !== "study-playbook"),
		});
	});
});

// ---------------------------------------------------------------------------
// 3j. Bytes outside marker pairs are silently ignored — notes-to-self in every
// gap position: before the first opener, between each adjacent pair of
// sections, and after the last closer.
// ---------------------------------------------------------------------------

describe("3j — bytes outside marker pairs are silently ignored", () => {
	const blocks = contractMarkers.map((marker) => makeBlock(marker));
	const gapCount = contractMarkers.length + 1;

	/** Interleave scratch text at the given gap positions (0 = before first opener, n = after last closer). */
	function withScratchAt(gaps: number[]): string {
		const parts: string[] = [];
		for (let gap = 0; gap < gapCount; gap++) {
			if (gaps.includes(gap)) parts.push(`Scratch text at gap ${gap}.`);
			if (gap < blocks.length) parts.push(blocks[gap]!);
		}
		return makeFrontmatter() + parts.join("\n\n") + "\n";
	}

	function expectDefaultSections(result: Awaited<ReturnType<typeof parseBrainAide>>): void {
		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return;
		for (const marker of contractMarkers) {
			expect(result[fieldOf(marker)]).toBe(`\n${defaultContent(marker)}`);
		}
	}

	it.each(Array.from({ length: gapCount }, (_, gap) => [gap]))(
		"scratch text at gap position %i → ok (outside bytes silently ignored)",
		async (gap) => {
			await writeBrainAide(tempDir, withScratchAt([gap]));

			expectDefaultSections(await parseBrainAide(tempDir));
		},
	);

	it("every gap position populated simultaneously → ok (outside bytes silently ignored)", async () => {
		await writeBrainAide(tempDir, withScratchAt(Array.from({ length: gapCount }, (_, gap) => gap)));

		expectDefaultSections(await parseBrainAide(tempDir));
	});

	it("marker-shaped content outside pairs is treated as plain bytes", async () => {
		// `<!-- aide-misc -->` contains "aide" so a permissive scan would flag it, but the
		// contract is that bytes outside recognized pair regions are not policed.
		const parts = [...blocks];
		parts.splice(1, 0, "<!-- aide-misc -->");
		await writeBrainAide(tempDir, makeFrontmatter() + parts.join("\n\n") + "\n");

		expectDefaultSections(await parseBrainAide(tempDir));
	});
});

// ---------------------------------------------------------------------------
// 3k. Verbatim invariant for every contract section (no substitution).
// ---------------------------------------------------------------------------

describe("3k — all body sections returned verbatim (no-substitution invariant)", () => {
	it.each(contractMarkers.map((marker) => [marker]))(
		"%s containing literal ${name} and ${rootPath} passes through byte-identical",
		async (marker) => {
			const sectionBody = `This ${marker} section contains \${name} literally.

It also has **markdown** and a [link](https://example.com).

The \${rootPath} value is also here for good measure.
`;
			await writeBrainAide(tempDir, makeContent({ content: { [marker]: sectionBody } }));

			const result = await parseBrainAide(tempDir);

			expect(result.kind).toBe("ok");
			if (result.kind !== "ok") return;
			const slice = result[fieldOf(marker)];
			// Substitution only runs on mcpServerConfig.args — never on a body section.
			expect(slice).toContain("${name}");
			expect(slice).toContain("${rootPath}");
			expect(slice).not.toContain("my-brain");
			expect(slice).toBe(`\n${sectionBody}`);
		},
	);
});

// ---------------------------------------------------------------------------
// 3l. Name is metadata, not dispatched on.
// ---------------------------------------------------------------------------

describe("3l — name is metadata, not dispatched on", () => {
	it("different name values both parse identically — result.kind is ok for both", async () => {
		const brainADir = await mkdtemp(join(tmpdir(), "aide-name-brain-a-"));
		const brainBDir = await mkdtemp(join(tmpdir(), "aide-name-brain-b-"));

		try {
			await writeBrainAide(brainADir, makeContent({ name: "brain-a", content: { orientation: "Orientation body for brain-a brain.\n" } }));
			await writeBrainAide(brainBDir, makeContent({ name: "brain-b", content: { orientation: "Orientation body for brain-b brain.\n" } }));

			const resultA = await parseBrainAide(brainADir);
			const resultB = await parseBrainAide(brainBDir);

			expect(resultA.kind).toBe("ok");
			expect(resultB.kind).toBe("ok");

			if (resultA.kind !== "ok" || resultB.kind !== "ok") return;

			expect(resultA.name).toBe("brain-a");
			expect(resultB.name).toBe("brain-b");
			expect(resultA.mcpServerConfig).toEqual(resultB.mcpServerConfig);
			expect(resultA.orientation).toBe("\nOrientation body for brain-a brain.\n");
			expect(resultB.orientation).toBe("\nOrientation body for brain-b brain.\n");
		} finally {
			await rm(brainADir, { recursive: true, force: true });
			await rm(brainBDir, { recursive: true, force: true });
		}
	});

	it("custom backend: a different name, launcher, args, and section wording unlike the template parses ok", async () => {
		const customContent: Partial<Record<BrainSectionMarker, string>> = Object.fromEntries(
			contractMarkers.map((marker) => [marker, `Hand-written ${marker} text for a Notion workspace; nothing like the bundled wording.\n`]),
		);
		await writeBrainAide(
			tempDir,
			makeContent({
				name: "notion",
				command: "uvx",
				argsLines: ['    - "notion-mcp"', '    - "--workspace"', '    - "acme-engineering"'],
				content: customContent,
			}),
		);

		const result = await parseBrainAide(tempDir);

		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return;
		expect(result.name).toBe("notion");
		expect(result.mcpServerConfig).toEqual({ command: "uvx", args: ["notion-mcp", "--workspace", "acme-engineering"] });
		for (const marker of contractMarkers) {
			expect(result[fieldOf(marker)]).toBe(`\n${customContent[marker]}`);
		}
	});
});

// ---------------------------------------------------------------------------
// 3m. interpolateArgs
// ---------------------------------------------------------------------------

describe("3m — interpolateArgs canonical config is a no-op", () => {
	it("canonical args have no placeholders — return is structurally equal to input args", () => {
		expect(interpolateArgs(CANONICAL_CONFIG)).toEqual(["@example/mcp-launcher", "D:/brains/my-brain"]);
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

		expect(interpolateArgs(config)).toEqual(["some-launcher", "--profile", "my-brain"]);
	});
});

describe("3m' — interpolateArgs is positional", () => {
	it("substitutes ${name} embedded within a larger string, not the whole arg", () => {
		const config: BrainAideConfig = {
			name: "my-brain",
			mcpServerConfig: { ...CANONICAL_CONFIG.mcpServerConfig, args: ["prefix-${name}-suffix"] },
		};

		expect(interpolateArgs(config)).toEqual(["prefix-my-brain-suffix"]);
	});

	it("substitutes multiple occurrences of ${name} within a single arg", () => {
		const config: BrainAideConfig = {
			name: "my-brain",
			mcpServerConfig: { ...CANONICAL_CONFIG.mcpServerConfig, args: ["${name}:${name}"] },
		};

		expect(interpolateArgs(config)).toEqual(["my-brain:my-brain"]);
	});
});

describe("3m'' — interpolateArgs does not touch the body sections", () => {
	it("interpolateArgs takes only config — it has no path that receives any body section", async () => {
		await writeBrainAide(tempDir, CANONICAL_BRAIN_AIDE);
		const parseResult = await parseBrainAide(tempDir);

		expect(parseResult.kind).toBe("ok");
		if (parseResult.kind !== "ok") return;

		const before = brainContract.map(({ field }) => parseResult[field]);

		const interpolated = interpolateArgs({
			name: parseResult.name,
			mcpServerConfig: parseResult.mcpServerConfig,
		});

		expect(brainContract.map(({ field }) => parseResult[field])).toEqual(before);
		expect(Array.isArray(interpolated)).toBe(true);
		expect(interpolated).not.toContain(parseResult.orientation);
	});
});

// ---------------------------------------------------------------------------
// 3n. parseBrainAideFromString parses bytes identically to parseBrainAide.
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
		expect(parseBrainAideFromString("").kind).toBe("malformed-frontmatter");
	});

	it("malformed-frontmatter — invalid YAML parses identically via both paths", async () => {
		const badYaml = `---\nmcpServerConfig:\n  args: [unclosed\n---\n\n` + makeBody();
		await writeBrainAide(tempDir, badYaml);

		const fromDisk = await parseBrainAide(tempDir);
		const fromString = parseBrainAideFromString(badYaml);

		expect(fromDisk.kind).toBe("malformed-frontmatter");
		expect(fromString.kind).toBe("malformed-frontmatter");
		expect(fromDisk).toEqual(fromString);
	});

	it.each<[BrainSectionMarker]>([["playbook-index"], ["study-playbook"], ["work-kanban"]])(
		"missing-sections — missing %s parses identically via both paths",
		async (marker) => {
			const content = makeContent({ omit: [marker] });
			await writeBrainAide(tempDir, content);

			const fromDisk = await parseBrainAide(tempDir);
			const fromString = parseBrainAideFromString(content);

			expect(fromDisk).toEqual({ kind: "missing-sections", sections: [marker] });
			expect(fromDisk).toEqual(fromString);
		},
	);

	it("malformed-body — a structural fault parses identically via both paths", async () => {
		const content = makeContent({ tokens: { config: { close: null } } });
		await writeBrainAide(tempDir, content);

		const fromDisk = await parseBrainAide(tempDir);
		const fromString = parseBrainAideFromString(content);

		expect(fromDisk.kind).toBe("malformed-body");
		expect(fromDisk).toEqual(fromString);
	});

	it("missing variant is only reachable via parseBrainAide (no file on disk)", async () => {
		expect((await parseBrainAide(tempDir)).kind).toBe("missing");
		expect(parseBrainAideFromString("").kind).toBe("malformed-frontmatter");
	});
});

// ---------------------------------------------------------------------------
// 3o. Per-section ownership: no config wrapper on the ok variant.
// ---------------------------------------------------------------------------

describe("3o — per-section ownership: all fields are top-level siblings on the flattened ok variant", () => {
	it("result.name, result.mcpServerConfig, and every contract field are top-level siblings; result.config is a string", async () => {
		await writeBrainAide(tempDir, CANONICAL_BRAIN_AIDE);

		const result = await parseBrainAide(tempDir);

		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return;

		expect(typeof result.name).toBe("string");
		expect(typeof result.mcpServerConfig).toBe("object");
		expect(typeof result.mcpServerConfig.command).toBe("string");
		expect(Array.isArray(result.mcpServerConfig.args)).toBe(true);

		for (const { field } of brainContract) {
			expect(typeof result[field]).toBe("string");
			expect(result[field].length).toBeGreaterThan(0);
		}

		// The body section literally named `config` is a STRING — not the parsed
		// BrainAideConfig object — and sits as a peer of the frontmatter fields.
		expect(typeof result.config).toBe("string");
	});
});

// ---------------------------------------------------------------------------
// 4a. Verbatim-slicing invariant for the sections added after the original four.
// ---------------------------------------------------------------------------

describe("4a — later sections participate in the verbatim-slicing invariant", () => {
	it.each(["config", "updatePlaybook", "kanbanBoard", "workKanban"] as const)(
		"result.%s is byte-identical to the canonical section",
		async (field) => {
			await writeBrainAide(tempDir, CANONICAL_BRAIN_AIDE);

			const result = await parseBrainAide(tempDir);

			expect(result.kind).toBe("ok");
			if (result.kind !== "ok") return;

			expect(result[field]).toBe(extractCanonicalSection(field));
		},
	);
});

// ---------------------------------------------------------------------------
// args type contract — string | null
//
// Null entries in mcpServerConfig.args are preserved verbatim at their
// original indexes through the parser and through interpolateArgs.
// ---------------------------------------------------------------------------

describe("args type contract — string | null", () => {
	it("single null at last args index is preserved verbatim — no compaction", async () => {
		await writeBrainAide(
			tempDir,
			makeContent({ argsLines: ['    - "@example/mcp-launcher"', '    - "D:/brains/my-brain"', "    -"] }),
		);

		const result = await parseBrainAide(tempDir);

		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return;

		expect(result.mcpServerConfig.args.length).toBe(3);
		expect(result.mcpServerConfig.args[0]).toBe("@example/mcp-launcher");
		expect(result.mcpServerConfig.args[1]).toBe("D:/brains/my-brain");
		expect(result.mcpServerConfig.args[2]).toBeNull();
	});

	it("two nulls at non-adjacent indexes (positions 1 and 3 of a four-entry list) are both preserved", async () => {
		await writeBrainAide(tempDir, makeContent({ argsLines: ['    - "launcher"', "    -", '    - "config"', "    -"] }));

		const result = await parseBrainAide(tempDir);

		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return;

		expect(result.mcpServerConfig.args.length).toBe(4);
		expect(result.mcpServerConfig.args[0]).toBe("launcher");
		expect(result.mcpServerConfig.args[1]).toBeNull();
		expect(result.mcpServerConfig.args[2]).toBe("config");
		expect(result.mcpServerConfig.args[3]).toBeNull();
	});

	it("all-null args list — every element is JS null at its original index", async () => {
		await writeBrainAide(tempDir, makeContent({ argsLines: ["    -", "    -", "    -"] }));

		const result = await parseBrainAide(tempDir);

		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return;

		expect(result.mcpServerConfig.args.length).toBe(3);
		expect(result.mcpServerConfig.args[0]).toBeNull();
		expect(result.mcpServerConfig.args[1]).toBeNull();
		expect(result.mcpServerConfig.args[2]).toBeNull();
	});

	it("null entry mixed with strings returns ok — null is part of the args contract, not a malformed value", async () => {
		await writeBrainAide(
			tempDir,
			makeContent({ argsLines: ['    - "@example/mcp-launcher"', "    -", '    - "D:/brains/my-brain"'] }),
		);

		const result = await parseBrainAide(tempDir);

		expect(result.kind).toBe("ok");
	});
});

describe("4b — interpolateArgs null-passthrough", () => {
	it("null at index 1 passes through unchanged — strings without placeholders also pass through", () => {
		const config: BrainAideConfig = {
			name: "my-brain",
			mcpServerConfig: { command: "npx", args: ["a", null, "b"] },
		};

		const result = interpolateArgs(config);

		expect(result).toEqual(["a", null, "b"]);
		expect(result.length).toBe(3);
		expect(result[1]).toBeNull();
	});

	it("${name} at index 2 is substituted; null at index 3 passes through unchanged", () => {
		const config: BrainAideConfig = {
			name: "dev-brain",
			mcpServerConfig: { command: "npx", args: ["some-launcher", "--profile", "${name}", null] },
		};

		const result = interpolateArgs(config);

		expect(result).toEqual(["some-launcher", "--profile", "dev-brain", null]);
		expect(result[3]).toBeNull();
	});
});

describe("args type contract round-trip — null survives parser and interpolateArgs at the same index", () => {
	it("null at args index 3 in source YAML is null at index 3 after parse and after interpolateArgs", async () => {
		await writeBrainAide(
			tempDir,
			makeContent({ argsLines: ['    - "@example/mcp-launcher"', '    - "--profile"', '    - "dev-brain"', "    -"] }),
		);

		const result = await parseBrainAide(tempDir);

		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return;

		expect(result.mcpServerConfig.args[3]).toBeNull();

		const interpolated = interpolateArgs({ name: result.name, mcpServerConfig: result.mcpServerConfig });

		expect(interpolated.length).toBe(4);
		expect(interpolated[3]).toBeNull();
	});
});

describe("3h — parseBrainAideFromString null-armed parity", () => {
	it("null-armed content string parses identically via disk and string paths — null index identical on both", async () => {
		const nullArmedContent = makeContent({
			argsLines: ['    - "@example/mcp-launcher"', '    - "D:/brains/my-brain"', "    -"],
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
