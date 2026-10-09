/**
 * Tests for buildBrainState — the five-state brain precondition detector.
 *
 * INVARIANT (3n): This file MUST NOT import from `@/service/brainBackends`.
 * The detector never calls resolveBackend or any registry function; importing
 * that module here would re-introduce the anti-pattern the spec explicitly
 * retired. If you find yourself reaching for brainBackends in a test, stop —
 * the test design is wrong.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, mkdir, writeFile, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

// Mock only the two helpers whose output the detector consumes structurally.
// parseBrainAide and readFile operate on real temp files — no fs mocking.
// readFile is wrapped in a passthrough spy so a test can assert which paths were read;
// the real implementation still runs against the temp files.
vi.mock("node:fs/promises", async (importOriginal) => {
	const actual = await importOriginal<typeof import("node:fs/promises")>();
	return { ...actual, readFile: vi.fn(actual.readFile) };
});
vi.mock("@/service/install/detectFramework/index.js");
vi.mock("@/service/install/resolveBrainHints/index.js");

import detectFramework from "@/service/install/detectFramework/index.js";
import resolveBrainHints from "@/service/install/resolveBrainHints/index.js";
import buildBrainState from "@/service/buildBrainState/index.js";
import parseBrainAide from "@/service/parseBrainAide/index.js";
import brainContract from "@/service/brainContract/index.js";
import toMarkerPair from "@/service/brainContract/toMarkerPair/index.js";
import type { BrainSectionMarker } from "@/types/index.js";

const mockDetectFramework = detectFramework as ReturnType<typeof vi.fn>;
const mockResolveBrainHints = resolveBrainHints as ReturnType<typeof vi.fn>;

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

const contractMarkers: BrainSectionMarker[] = brainContract.map(({ marker }) => marker);

/**
 * Brain.aide body derived from the published `brainContract` through `toMarkerPair`,
 * so fixtures track the contract instead of restating the section list or marker
 * bytes. `omit` leaves whole sections out (an outdated config); `unclosed` drops one
 * section's closing marker (a structurally malformed body).
 */
function makeBody({
	omit = [],
	unclosed,
}: {
	omit?: BrainSectionMarker[];
	unclosed?: BrainSectionMarker;
} = {}): string {
	return (
		contractMarkers
			.filter((marker) => !omit.includes(marker))
			.map((marker) => {
				const { open, close } = toMarkerPair(marker);
				return marker === unclosed
					? `${open}\nSome ${marker} content.\n`
					: `${open}\nSome ${marker} content.\n${close}`;
			})
			.join("\n\n") + "\n"
	);
}

/**
 * Valid brain.aide content against the two-field frontmatter schema plus a
 * contract-derived body. Emits ONLY `name` and `mcpServerConfig.{command, args}` in
 * the frontmatter; `extraFrontmatter` appends raw lines (e.g. a deprecated field).
 */
function makeBrainAideContent({
	name = "obsidian",
	command = "npx",
	args = ["@bitbonsai/mcpvault", "<vault-path>"],
	extraFrontmatter = [],
	omit,
	unclosed,
}: {
	name?: string;
	command?: string;
	args?: (string | null)[];
	extraFrontmatter?: string[];
	omit?: BrainSectionMarker[];
	unclosed?: BrainSectionMarker;
}): string {
	// Null entries emit as a bare dash (YAML null) so parseBrainAide produces JS null.
	// String entries emit quoted so the parser preserves them as strings.
	const argsYaml = args.map((a) => (a === null ? "    -" : `    - "${a}"`)).join("\n");
	return [
		"---",
		`name: ${name}`,
		...extraFrontmatter,
		"mcpServerConfig:",
		`  command: ${command}`,
		"  args:",
		argsYaml,
		"---",
		"",
		makeBody({ omit, unclosed }),
	].join("\n");
}

/** Build a .mcp.json whose mcpServers.brain entry carries the given command/args. */
function makeMcpJson(brainEntry: { command: string; args: (string | null)[] }): string {
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

describe("buildBrainState — brain-aide-invalid: present but unreadable", () => {
	it("returns brain-aide-invalid/malformed naming the read error, never no-brain-aide, when brain.aide exists but cannot be read", async () => {
		// A directory at the config path: the entry exists, readFile fails with EISDIR.
		await mkdir(join(tempRoot, ".aide", "config", "brain.aide"));

		const result = await buildBrainState(tempRoot);

		expect(result.status).toBe("brain-aide-invalid");
		if (result.status === "brain-aide-invalid") {
			expect(result.fault).toEqual({
				kind: "malformed",
				reason: "cannot read .aide/config/brain.aide: path is a directory (EISDIR)",
			});
		}
		expect(result).not.toHaveProperty("name");
	});
});

// ---------------------------------------------------------------------------
// 3c. brain-aide-invalid — brain.aide exists but frontmatter is malformed YAML.
// ---------------------------------------------------------------------------

const BROKEN_FRONTMATTER = [
	"---",
	"name: obsidian",
	"mcpServerConfig: [this is: broken: yaml: {",
	"---",
	"",
	makeBody(),
].join("\n");

/** Assert the result is brain-aide-invalid/malformed and its reason is the parser's own, verbatim. */
async function expectMalformedWithParserReason(result: Awaited<ReturnType<typeof buildBrainState>>) {
	const parsed = await parseBrainAide(tempRoot);
	if (parsed.kind !== "malformed-frontmatter" && parsed.kind !== "malformed-body") {
		throw new Error(`fixture should be malformed, parser returned ${parsed.kind}`);
	}
	expect(parsed.reason.length).toBeGreaterThan(0);
	expect(result.status).toBe("brain-aide-invalid");
	if (result.status === "brain-aide-invalid") {
		expect(result.fault).toEqual({ kind: "malformed", reason: parsed.reason });
	}
	expect(result).not.toHaveProperty("name");
	expect(result).not.toHaveProperty("rootPath");
	expect(result).not.toHaveProperty("connector");
	expect(result).not.toHaveProperty("backend");
}

describe("buildBrainState — brain-aide-invalid: frontmatter malformed (3c)", () => {
	it("returns brain-aide-invalid with the parser's reason when brain.aide contains broken YAML frontmatter", async () => {
		await writeBrainAide(BROKEN_FRONTMATTER);

		await expectMalformedWithParserReason(await buildBrainState(tempRoot));
	});
});

// ---------------------------------------------------------------------------
// 3d. brain-aide-invalid — valid frontmatter with a structurally malformed body,
// and the outdated-but-sound case (a body carrying no sections at all).
// ---------------------------------------------------------------------------

describe("buildBrainState — brain-aide-invalid: body (3d)", () => {
	it("returns brain-aide-invalid/malformed with the parser's reason when a section's closing marker is missing", async () => {
		await writeBrainAide(makeBrainAideContent({ unclosed: "study-playbook" }));

		await expectMalformedWithParserReason(await buildBrainState(tempRoot));
	});

	it("returns brain-aide-invalid/missing-sections naming every contract section when the body has no marker pairs", async () => {
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

		expect(result.status).toBe("brain-aide-invalid");
		if (result.status === "brain-aide-invalid") {
			expect(result.fault).toEqual({ kind: "missing-sections", sections: contractMarkers });
		}
		expect(result).not.toHaveProperty("name");
	});
});

// ---------------------------------------------------------------------------
// 3e. brain-aide-invalid — parser rejects deprecated field alongside valid fields.
// ---------------------------------------------------------------------------

describe("buildBrainState — brain-aide-invalid: parser rejects deprecated field (3e)", () => {
	it("returns brain-aide-invalid/malformed with the parser's reason when frontmatter carries a deprecated field (rootPath)", async () => {
		await writeBrainAide(
			makeBrainAideContent({ extraFrontmatter: ["rootPath: D:/notes/something"] }),
		);

		await expectMalformedWithParserReason(await buildBrainState(tempRoot));
	});
});

// ---------------------------------------------------------------------------
// 3s. brain-aide-invalid — outdated config (whole contract sections absent).
// ---------------------------------------------------------------------------

describe("buildBrainState — brain-aide-invalid: outdated config (3s)", () => {
	const OUTDATED_ARGS = ["@bitbonsai/mcpvault", "/x/vault"];

	it("returns brain-aide-invalid with the missing sections when kanban-index and kanban-create are absent", async () => {
		await writeBrainAide(
			makeBrainAideContent({ args: OUTDATED_ARGS, omit: ["kanban-index", "kanban-create"] }),
		);

		const result = await buildBrainState(tempRoot);

		expect(result.status).toBe("brain-aide-invalid");
		if (result.status === "brain-aide-invalid") {
			expect(result.fault).toEqual({
				kind: "missing-sections",
				sections: ["kanban-index", "kanban-create"],
			});
		}
		expect(result).not.toHaveProperty("name");
	});

	it("never reads .mcp.json for an outdated config", async () => {
		await writeBrainAide(makeBrainAideContent({ args: OUTDATED_ARGS, omit: ["kanban-index"] }));
		// A valid, matching .mcp.json is present; reading it would be the only way to reach ok/drift.
		await writeMcpJson(makeMcpJson({ command: "npx", args: OUTDATED_ARGS }));
		const readFileMock = readFile as unknown as ReturnType<typeof vi.fn>;
		readFileMock.mockClear();

		const result = await buildBrainState(tempRoot);

		expect(result.status).toBe("brain-aide-invalid");
		const mcpPath = join(tempRoot, FIXED_FRAMEWORK_CONFIG.mcpConfigPath);
		const readPaths = readFileMock.mock.calls.map(([path]) => String(path));
		expect(readPaths).toContain(join(tempRoot, ".aide", "config", "brain.aide"));
		expect(readPaths).not.toContain(mcpPath);
	});

	it("still reports brain-aide-invalid when the outdated config's args also carry null (parse precedes the null-slot check)", async () => {
		await writeBrainAide(
			makeBrainAideContent({ args: ["@bitbonsai/mcpvault", null], omit: ["kanban-create"] }),
		);

		const result = await buildBrainState(tempRoot);

		expect(result.status).toBe("brain-aide-invalid");
	});

	it("carries hints on the brain-aide-invalid status", async () => {
		const hint = [{ source: "env" as const, path: "/candidate/vault" }];
		mockResolveBrainHints.mockResolvedValue(hint);
		await writeBrainAide(makeBrainAideContent({ args: OUTDATED_ARGS, omit: ["kanban-create"] }));

		const result = await buildBrainState(tempRoot);

		expect(result.status).toBe("brain-aide-invalid");
		expect(result.hints).toEqual(hint);
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

	it("resolves to brain-aide-invalid (malformed frontmatter) without rejecting", async () => {
		await writeBrainAide(BROKEN_FRONTMATTER);
		await expect(buildBrainState(tempRoot)).resolves.toMatchObject({
			status: "brain-aide-invalid",
			fault: { kind: "malformed" },
		});
	});

	it("resolves to brain-aide-invalid (body malformed) without rejecting", async () => {
		await writeBrainAide(makeBrainAideContent({ unclosed: "orientation" }));
		await expect(buildBrainState(tempRoot)).resolves.toMatchObject({
			status: "brain-aide-invalid",
			fault: { kind: "malformed" },
		});
	});

	it("resolves to brain-aide-invalid (outdated config) without rejecting", async () => {
		await writeBrainAide(makeBrainAideContent({ omit: ["kanban-index", "kanban-create"] }));
		await expect(buildBrainState(tempRoot)).resolves.toMatchObject({
			status: "brain-aide-invalid",
			fault: { kind: "missing-sections" },
		});
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

// ---------------------------------------------------------------------------
// 3p. Null-armed brain.aide with no .mcp.json returns no-mcp-entry.
// Anchors the basic null-detection branch: pre-check fires before any .mcp.json read.
// ---------------------------------------------------------------------------

describe("buildBrainState — null-armed args: no .mcp.json (3p)", () => {
	it("returns no-mcp-entry when brain.aide args contain a null and .mcp.json is absent", async () => {
		await writeBrainAide(
			makeBrainAideContent({
				name: "obsidian",
				command: "npx",
				args: ["@bitbonsai/mcpvault", null],
			}),
		);
		// No .mcp.json written — the null pre-check should short-circuit before any read.

		const result = await buildBrainState(tempRoot);

		expect(result.status).toBe("no-mcp-entry");
		if (result.status === "no-mcp-entry") {
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
// 3q. Null-armed brain.aide with a matching null-armed .mcp.json returns
// no-mcp-entry, NOT ok.
//
// This is the canonical regression-prevention case. The two files agree
// byte-for-byte at the null position — the structural drift comparison from
// Step 9 would return ok if it were allowed to run. The null pre-check from
// Step 4 must short-circuit before that comparison fires.
//
// Without this test, a future contributor moving the null check below the
// .mcp.json read would silently regress the detector and the suite would
// still go green. This test makes that regression a hard failure.
//
// Spec reference: Bad examples — "Returning `ok` when both sides match
// byte-for-byte on null."
// ---------------------------------------------------------------------------

describe("buildBrainState — null-armed args: matching null-armed .mcp.json (3q)", () => {
	it("returns no-mcp-entry, NOT ok, when brain.aide and .mcp.json agree byte-for-byte on null args", async () => {
		await writeBrainAide(
			makeBrainAideContent({
				name: "obsidian",
				command: "npx",
				args: ["@bitbonsai/mcpvault", null],
			}),
		);
		// .mcp.json whose mcpServers.brain.args is byte-identical to the brain.aide-derived
		// array — both have a JSON null at position 1. The drift comparison would return ok
		// if it ran; the null pre-check must prevent it from ever running.
		await writeMcpJson(
			makeMcpJson({ command: "npx", args: ["@bitbonsai/mcpvault", null] }),
		);

		const result = await buildBrainState(tempRoot);

		// The null pre-check takes precedence over the drift comparison.
		// Bytes that agree on null have agreed on broken state, not health.
		expect(result.status).toBe("no-mcp-entry");
		expect(result.status).not.toBe("ok");
		expect(result.status).not.toBe("mcp-drift");
		if (result.status === "no-mcp-entry") {
			expect(result.name).toBe("obsidian");
			expect(result.hints).toEqual([]);
		}
	});
});

// ---------------------------------------------------------------------------
// 3r. Non-null brain.aide with matching .mcp.json returns ok.
// Anchors the negative case — null pre-check does NOT fire when no nulls
// are present. Also guards against wrong predicates (e.g. a === "null").
// ---------------------------------------------------------------------------

describe("buildBrainState — null-armed args: no nulls present, ok path (3r)", () => {
	it.each([
		["single non-null arg", ["@bitbonsai/mcpvault"]],
		["two non-null args", ["@bitbonsai/mcpvault", "/x/vault"]],
		["three non-null args", ["@bitbonsai/mcpvault", "/x/vault", "--flag"]],
		[
			'literal string "null" is NOT JS null and must not trigger the pre-check',
			["@bitbonsai/mcpvault", "null"],
		],
		[
			'literal string "~" is NOT JS null and must not trigger the pre-check',
			["@bitbonsai/mcpvault", "~"],
		],
	])(
		"returns ok when args contain %s and .mcp.json matches exactly",
		async (_desc, args) => {
			await writeBrainAide(
				makeBrainAideContent({
					name: "obsidian",
					command: "npx",
					args,
				}),
			);
			await writeMcpJson(makeMcpJson({ command: "npx", args }));

			const result = await buildBrainState(tempRoot);

			// The null pre-check must NOT fire on fully-wired (null-free) configs.
			expect(result.status).toBe("ok");
			if (result.status === "ok") {
				expect(result.name).toBe("obsidian");
				expect(result.hints).toEqual([]);
			}
		},
	);
});
