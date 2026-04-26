/**
 * Tests for brain tool — five-status branching + verbatim-prose invariants.
 *
 * INVARIANT (4h): This file MUST NOT import from `@/service/brainBackends`.
 * The brain tool never dispatches through a backend registry; importing that
 * module here would re-introduce the anti-pattern the spec explicitly retired.
 * If you find yourself reaching for brainBackends in a test, stop — the test
 * design is wrong.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Declare mocks before any import — vi.mock() is hoisted above all imports.
vi.mock("@/service/buildBrainState/index.js");
vi.mock("@/service/parseBrainAide/index.js");

import buildBrainState from "@/service/buildBrainState/index.js";
import parseBrainAide from "@/service/parseBrainAide/index.js";
import brain from "./index.js";

const mockBuildBrainState = buildBrainState as ReturnType<typeof vi.fn>;
const mockParseBrainAide = parseBrainAide as ReturnType<typeof vi.fn>;

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

/** Minimal valid BrainAideConfig — exact field values are not under test here. */
const MINIMAL_CONFIG = {
	connector: "obsidian",
	rootPath: "/x",
	entryFile: "CLAUDE.md",
	mcpServerConfig: { command: "npx", args: ["-y", "obsidian-mcp", "/x"] },
	tools: { read: "mcp__brain__read_note", search: "mcp__brain__search_notes" },
};

/** ok state fixture with a given connector. */
function makeOkState(connector = "obsidian") {
	return {
		status: "ok" as const,
		rootPath: "/x",
		connector,
		hints: [],
	};
}

/** Verbatim prose string that contains characters a substitution pass would
 *  transform: a ${rootPath} sequence, a [[wikilink]], and markdown formatting.
 *  Used to assert the no-substitution invariant. */
const VERBATIM_PROSE =
	"exact prose with literal ${rootPath} characters and a [[wikilink]] and **markdown**";

// ---------------------------------------------------------------------------
// Test setup
// ---------------------------------------------------------------------------

beforeEach(() => {
	vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// 4a. ok — returns the prose body verbatim (no-substitution invariant)
// ---------------------------------------------------------------------------

describe("brain — ok: verbatim prose (4a)", () => {
	it("returns instructions byte-identical to the prose body from parseBrainAide", async () => {
		mockBuildBrainState.mockResolvedValue(makeOkState());
		mockParseBrainAide.mockResolvedValue({
			kind: "ok",
			config: MINIMAL_CONFIG,
			prose: VERBATIM_PROSE,
		});

		const result = await brain("/root");

		expect(result.instructions).toBe(VERBATIM_PROSE);
	});

	it("preserves literal ${rootPath} characters without substitution", async () => {
		const proseWithPlaceholder = "Use ${rootPath} to find the vault at ${rootPath}";
		mockBuildBrainState.mockResolvedValue(makeOkState());
		mockParseBrainAide.mockResolvedValue({
			kind: "ok",
			config: MINIMAL_CONFIG,
			prose: proseWithPlaceholder,
		});

		const result = await brain("/root");

		expect(result.instructions).toBe(proseWithPlaceholder);
	});
});

// ---------------------------------------------------------------------------
// 4b. ok — response shape has no `backend` field
// ---------------------------------------------------------------------------

describe("brain — ok: no backend field (4b)", () => {
	it("does NOT include a backend field on the ok branch", async () => {
		mockBuildBrainState.mockResolvedValue(makeOkState());
		mockParseBrainAide.mockResolvedValue({
			kind: "ok",
			config: MINIMAL_CONFIG,
			prose: "some prose",
		});

		const result = await brain("/root");

		expect(result).not.toHaveProperty("backend");
	});
});

// ---------------------------------------------------------------------------
// 4c. no-brain-aide — canonical remediation prose
// ---------------------------------------------------------------------------

describe("brain — no-brain-aide: remediation prose (4c)", () => {
	it("returns status no-brain-aide with prose containing npx aidemd-mcp init", async () => {
		mockBuildBrainState.mockResolvedValue({ status: "no-brain-aide", hints: [] });

		const result = await brain("/root");

		expect(result.status).toBe("no-brain-aide");
		// Load-bearing phrase: the agent must surface the exact recovery command.
		expect(result.instructions).toContain("npx aidemd-mcp init");
	});

	it("never calls parseBrainAide on the no-brain-aide branch", async () => {
		mockBuildBrainState.mockResolvedValue({ status: "no-brain-aide", hints: [] });

		await brain("/root");

		expect(mockParseBrainAide).not.toHaveBeenCalled();
	});
});

// ---------------------------------------------------------------------------
// 4d. no-mcp-entry — canonical remediation prose
// ---------------------------------------------------------------------------

describe("brain — no-mcp-entry: remediation prose (4d)", () => {
	it("returns status no-mcp-entry with prose containing npx aidemd-mcp sync", async () => {
		mockBuildBrainState.mockResolvedValue({
			status: "no-mcp-entry",
			rootPath: "/x",
			connector: "obsidian",
			hints: [],
		});

		const result = await brain("/root");

		expect(result.status).toBe("no-mcp-entry");
		// Load-bearing phrase: sync is the only recovery command for a missing entry.
		expect(result.instructions).toContain("npx aidemd-mcp sync");
	});
});

// ---------------------------------------------------------------------------
// 4e. invalid-path — canonical remediation prose
// ---------------------------------------------------------------------------

describe("brain — invalid-path: remediation prose (4e)", () => {
	it("returns status invalid-path with prose mentioning rootPath correction", async () => {
		mockBuildBrainState.mockResolvedValue({
			status: "invalid-path",
			rootPath: "/broken/path",
			connector: "obsidian",
			hints: [],
		});

		const result = await brain("/root");

		expect(result.status).toBe("invalid-path");
		// Load-bearing phrase: agent must tell the user to correct rootPath.
		expect(result.instructions).toContain("rootPath");
	});
});

// ---------------------------------------------------------------------------
// 4f. mcp-drift — canonical remediation prose
// ---------------------------------------------------------------------------

describe("brain — mcp-drift: remediation prose (4f)", () => {
	it("returns status mcp-drift with prose containing sync command and drift mention", async () => {
		mockBuildBrainState.mockResolvedValue({
			status: "mcp-drift",
			rootPath: "/x",
			connector: "obsidian",
			hints: [],
		});

		const result = await brain("/root");

		expect(result.status).toBe("mcp-drift");
		// Load-bearing phrases: sync is the recovery command; prose must name drift.
		expect(result.instructions).toContain("npx aidemd-mcp sync");
		expect(result.instructions.toLowerCase()).toContain("disagree");
	});
});

// ---------------------------------------------------------------------------
// 4g. defensive fallback — parseBrainAide returns missing despite ok state
// ---------------------------------------------------------------------------

describe("brain — defensive fallback: parseBrainAide non-ok (4g)", () => {
	it("returns invalid-path with non-empty instructions when parseBrainAide returns missing", async () => {
		// Simulate the upstream contract violation: buildBrainState says ok but
		// parseBrainAide returns missing (e.g. file deleted between the two calls).
		mockBuildBrainState.mockResolvedValue(makeOkState());
		mockParseBrainAide.mockResolvedValue({ kind: "missing" });

		const result = await brain("/root");

		expect(result.status).toBe("invalid-path");
		expect(result.instructions.length).toBeGreaterThan(0);
	});

	it("returns invalid-path when parseBrainAide returns malformed-frontmatter", async () => {
		mockBuildBrainState.mockResolvedValue(makeOkState());
		mockParseBrainAide.mockResolvedValue({
			kind: "malformed-frontmatter",
			reason: "required field connector is missing",
		});

		const result = await brain("/root");

		expect(result.status).toBe("invalid-path");
		expect(result.instructions.length).toBeGreaterThan(0);
	});
});

// ---------------------------------------------------------------------------
// 4i. instructions never empty — all branches + defensive fallback
// ---------------------------------------------------------------------------

describe("brain — instructions always non-empty (4i)", () => {
	it.each([
		["no-brain-aide", { status: "no-brain-aide" as const, hints: [] }],
		[
			"no-mcp-entry",
			{
				status: "no-mcp-entry" as const,
				rootPath: "/x",
				connector: "obsidian",
				hints: [],
			},
		],
		[
			"invalid-path",
			{
				status: "invalid-path" as const,
				rootPath: "/x",
				connector: "obsidian",
				hints: [],
			},
		],
		[
			"mcp-drift",
			{
				status: "mcp-drift" as const,
				rootPath: "/x",
				connector: "obsidian",
				hints: [],
			},
		],
	])(
		"instructions is non-empty on %s branch",
		async (_label, state) => {
			mockBuildBrainState.mockResolvedValue(state);

			const result = await brain("/root");

			expect(result.instructions.length).toBeGreaterThan(0);
		},
	);

	it("instructions is non-empty on ok branch", async () => {
		mockBuildBrainState.mockResolvedValue(makeOkState());
		mockParseBrainAide.mockResolvedValue({
			kind: "ok",
			config: MINIMAL_CONFIG,
			prose: "non-empty prose",
		});

		const result = await brain("/root");

		expect(result.instructions.length).toBeGreaterThan(0);
	});

	it("instructions is non-empty on the defensive fallback branch", async () => {
		// parseBrainAide returns non-ok despite ok state.
		mockBuildBrainState.mockResolvedValue(makeOkState());
		mockParseBrainAide.mockResolvedValue({ kind: "missing" });

		const result = await brain("/root");

		expect(result.instructions.length).toBeGreaterThan(0);
	});
});

// ---------------------------------------------------------------------------
// 4j. No connector dispatch — ok branch output is identical across connectors
// ---------------------------------------------------------------------------

describe("brain — no connector dispatch (4j)", () => {
	it("returns byte-identical instructions for obsidian and notion when prose input is identical", async () => {
		const prose = "identical prose for both connectors";

		mockBuildBrainState.mockResolvedValue(makeOkState("obsidian"));
		mockParseBrainAide.mockResolvedValue({
			kind: "ok",
			config: MINIMAL_CONFIG,
			prose,
		});
		const obsidianResult = await brain("/root");

		mockBuildBrainState.mockResolvedValue(makeOkState("notion"));
		mockParseBrainAide.mockResolvedValue({
			kind: "ok",
			config: { ...MINIMAL_CONFIG, connector: "notion" },
			prose,
		});
		const notionResult = await brain("/root");

		// Identical prose input must produce identical instructions output — no
		// connector-keyed branching inside the tool.
		expect(obsidianResult.instructions).toBe(notionResult.instructions);
	});
});
