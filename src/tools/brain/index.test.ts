/**
 * Tests for brain tool — BrainState-contract branching + verbatim-bytes invariants.
 *
 * Branches covered: one describe block per BrainState status (`ok`, `no-brain-aide`,
 * `no-mcp-entry`, `mcp-drift`) plus the defensive-fallback path. Tests are written
 * against the BrainState vocabulary exported from `@/types/index.ts`; the test
 * count is derived from those branches, not pinned as a fixed number.
 *
 * INVARIANT: This file MUST NOT import from `@/service/brainBackends`.
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
import brain, { BrainInput } from "./index.js";

const mockBuildBrainState = buildBrainState as ReturnType<typeof vi.fn>;
const mockParseBrainAide = parseBrainAide as ReturnType<typeof vi.fn>;

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

/** Minimal valid BrainAideConfig — exact field values are not under test here. */
const MINIMAL_CONFIG = {
	name: "obsidian",
	mcpServerConfig: {
		command: "npx",
		args: ["@bitbonsai/mcpvault", "/x"],
	},
};

/** ok state fixture with a given name. */
function makeOkState(name = "obsidian") {
	return {
		status: "ok" as const,
		name,
		hints: [],
	};
}

/**
 * Verbatim orientation string with characters a substitution pass would transform:
 * a ${rootPath} sequence, a [[reference]], and markdown formatting. Content is
 * distinct from VERBATIM_CONFIG so cross-section bleed-through is a falsifiable failure.
 */
const VERBATIM_ORIENTATION =
	"orientation section with literal ${rootPath} and a [[orientation-reference]] and **bold**";

/**
 * Verbatim config string with characters a substitution pass would transform.
 * Distinct bytes from VERBATIM_ORIENTATION — returning orientation bytes on a
 * config call (or vice versa) would fail assertions in either direction.
 */
const VERBATIM_CONFIG =
	"config section with literal ${rootPath} and a [[config-reference]] and *italic*";

/** Minimal ok parse result fixture — all six fields required by ParseBrainAideResult["ok"]. */
function makeOkParseResult(overrides: { orientation?: string; config?: string } = {}) {
	return {
		kind: "ok" as const,
		name: "obsidian",
		mcpServerConfig: MINIMAL_CONFIG.mcpServerConfig,
		orientation: overrides.orientation ?? VERBATIM_ORIENTATION,
		config: overrides.config ?? VERBATIM_CONFIG,
		playbookIndex: "playbook-index-placeholder",
		studyPlaybook: "study-playbook-placeholder",
		updatePlaybook: "update-playbook-placeholder",
		researchIndex: "research-index-placeholder",
	};
}

// ---------------------------------------------------------------------------
// Test setup
// ---------------------------------------------------------------------------

beforeEach(() => {
	vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Step 5a-5c. ok — orientation kind (default and explicit)
// ---------------------------------------------------------------------------

describe("brain — ok: orientation kind", () => {
	it("returns VERBATIM_ORIENTATION when called with no input (default kind)", async () => {
		mockBuildBrainState.mockResolvedValue(makeOkState());
		mockParseBrainAide.mockResolvedValue(makeOkParseResult());

		const result = await brain("/root");

		expect(result.instructions).toBe(VERBATIM_ORIENTATION);
	});

	it("returns VERBATIM_ORIENTATION when called with kind: orientation (explicit)", async () => {
		mockBuildBrainState.mockResolvedValue(makeOkState());
		mockParseBrainAide.mockResolvedValue(makeOkParseResult());

		const result = await brain("/root", { kind: "orientation" });

		expect(result.instructions).toBe(VERBATIM_ORIENTATION);
	});

	it("NEVER returns VERBATIM_CONFIG on the orientation path (cross-section bleed-through)", async () => {
		mockBuildBrainState.mockResolvedValue(makeOkState());
		mockParseBrainAide.mockResolvedValue(makeOkParseResult());

		const result = await brain("/root");

		expect(result.instructions).not.toBe(VERBATIM_CONFIG);
	});
});

// ---------------------------------------------------------------------------
// Step 5d. ok — config kind
// ---------------------------------------------------------------------------

describe("brain — ok: config kind", () => {
	it("returns VERBATIM_CONFIG when called with kind: config", async () => {
		mockBuildBrainState.mockResolvedValue(makeOkState());
		mockParseBrainAide.mockResolvedValue(makeOkParseResult());

		const result = await brain("/root", { kind: "config" });

		expect(result.instructions).toBe(VERBATIM_CONFIG);
	});

	it("NEVER returns VERBATIM_ORIENTATION on the config path (cross-section bleed-through)", async () => {
		mockBuildBrainState.mockResolvedValue(makeOkState());
		mockParseBrainAide.mockResolvedValue(makeOkParseResult());

		const result = await brain("/root", { kind: "config" });

		expect(result.instructions).not.toBe(VERBATIM_ORIENTATION);
	});
});

// ---------------------------------------------------------------------------
// Step 5e. No substitution on either kind — ${...} sequences preserved verbatim
// ---------------------------------------------------------------------------

describe("brain — no substitution on either kind", () => {
	it("preserves literal ${...} sequences byte-identical in orientation", async () => {
		const orientationWithPlaceholder = "orientation: ${PLACEHOLDER_A} and ${PLACEHOLDER_B}";
		mockBuildBrainState.mockResolvedValue(makeOkState());
		mockParseBrainAide.mockResolvedValue(makeOkParseResult({ orientation: orientationWithPlaceholder }));

		const result = await brain("/root", { kind: "orientation" });

		expect(result.instructions).toBe(orientationWithPlaceholder);
	});

	it("preserves literal ${...} sequences byte-identical in config", async () => {
		const configWithPlaceholder = "config: ${PLACEHOLDER_C} and ${PLACEHOLDER_D}";
		mockBuildBrainState.mockResolvedValue(makeOkState());
		mockParseBrainAide.mockResolvedValue(makeOkParseResult({ config: configWithPlaceholder }));

		const result = await brain("/root", { kind: "config" });

		expect(result.instructions).toBe(configWithPlaceholder);
	});
});

// ---------------------------------------------------------------------------
// Step 6a-6b. ok — response shape has no `name`, `backend`, `connector`, or `kind` field
// ---------------------------------------------------------------------------

describe("brain — ok: no name, backend, connector, or kind field on response", () => {
	it("does NOT include a backend field on the ok orientation path", async () => {
		mockBuildBrainState.mockResolvedValue(makeOkState());
		mockParseBrainAide.mockResolvedValue(makeOkParseResult());

		const result = await brain("/root", { kind: "orientation" });

		expect(result).not.toHaveProperty("backend");
	});

	it("does NOT include a name field on the ok orientation path", async () => {
		mockBuildBrainState.mockResolvedValue(makeOkState());
		mockParseBrainAide.mockResolvedValue(makeOkParseResult());

		const result = await brain("/root", { kind: "orientation" });

		expect(result).not.toHaveProperty("name");
	});

	it("does NOT include a connector field on the ok orientation path", async () => {
		mockBuildBrainState.mockResolvedValue(makeOkState());
		mockParseBrainAide.mockResolvedValue(makeOkParseResult());

		const result = await brain("/root", { kind: "orientation" });

		expect(result).not.toHaveProperty("connector");
	});

	it("does NOT include a backend field on the ok config path", async () => {
		mockBuildBrainState.mockResolvedValue(makeOkState());
		mockParseBrainAide.mockResolvedValue(makeOkParseResult());

		const result = await brain("/root", { kind: "config" });

		expect(result).not.toHaveProperty("backend");
	});

	it("does NOT include a name field on the ok config path", async () => {
		mockBuildBrainState.mockResolvedValue(makeOkState());
		mockParseBrainAide.mockResolvedValue(makeOkParseResult());

		const result = await brain("/root", { kind: "config" });

		expect(result).not.toHaveProperty("name");
	});

	it("does NOT include a connector field on the ok config path", async () => {
		mockBuildBrainState.mockResolvedValue(makeOkState());
		mockParseBrainAide.mockResolvedValue(makeOkParseResult());

		const result = await brain("/root", { kind: "config" });

		expect(result).not.toHaveProperty("connector");
	});

	// Step 6b — kind must NOT be echoed back on the wire
	it("does NOT include a kind field on the response when kind: orientation was supplied", async () => {
		mockBuildBrainState.mockResolvedValue(makeOkState());
		mockParseBrainAide.mockResolvedValue(makeOkParseResult());

		const result = await brain("/root", { kind: "orientation" });

		expect(result).not.toHaveProperty("kind");
	});

	it("does NOT include a kind field on the response when kind: config was supplied", async () => {
		mockBuildBrainState.mockResolvedValue(makeOkState());
		mockParseBrainAide.mockResolvedValue(makeOkParseResult());

		const result = await brain("/root", { kind: "config" });

		expect(result).not.toHaveProperty("kind");
	});

	it("does NOT include a name field on a non-ok branch", async () => {
		mockBuildBrainState.mockResolvedValue({ status: "no-brain-aide", hints: [] });

		const result = await brain("/root");

		expect(result).not.toHaveProperty("name");
		expect(result).not.toHaveProperty("backend");
		expect(result).not.toHaveProperty("connector");
	});
});

// ---------------------------------------------------------------------------
// Step 6c. No name dispatch — ok branch output is identical across names, for both kinds
// ---------------------------------------------------------------------------

describe("brain — no name dispatch", () => {
	it("returns byte-identical instructions for obsidian and notion on orientation kind", async () => {
		const orientationText = "identical orientation for both names";

		mockBuildBrainState.mockResolvedValue(makeOkState("obsidian"));
		mockParseBrainAide.mockResolvedValue(makeOkParseResult({ orientation: orientationText }));
		const obsidianResult = await brain("/root", { kind: "orientation" });

		mockBuildBrainState.mockResolvedValue(makeOkState("notion"));
		mockParseBrainAide.mockResolvedValue(
			makeOkParseResult({ orientation: orientationText }),
		);
		const notionResult = await brain("/root", { kind: "orientation" });

		// Identical orientation input must produce identical instructions — no name-keyed branching.
		expect(obsidianResult.instructions).toBe(notionResult.instructions);
	});

	it("returns byte-identical instructions for obsidian and notion on config kind", async () => {
		const configText = "identical config for both names";

		mockBuildBrainState.mockResolvedValue(makeOkState("obsidian"));
		mockParseBrainAide.mockResolvedValue(makeOkParseResult({ config: configText }));
		const obsidianResult = await brain("/root", { kind: "config" });

		mockBuildBrainState.mockResolvedValue(makeOkState("notion"));
		mockParseBrainAide.mockResolvedValue(makeOkParseResult({ config: configText }));
		const notionResult = await brain("/root", { kind: "config" });

		// Identical config input must produce identical instructions — no name-keyed branching.
		expect(obsidianResult.instructions).toBe(notionResult.instructions);
	});
});

// ---------------------------------------------------------------------------
// Step 7a-7b. Non-ok branches — kind-agnosticism
// ---------------------------------------------------------------------------

describe("brain — no-brain-aide: remediation prose", () => {
	it("returns status no-brain-aide with prose containing npx aidemd-mcp init", async () => {
		mockBuildBrainState.mockResolvedValue({ status: "no-brain-aide", hints: [] });

		const result = await brain("/root");

		expect(result.status).toBe("no-brain-aide");
		// Load-bearing phrase: the agent must surface the exact recovery command.
		expect(result.instructions).toContain("npx aidemd-mcp init");
	});

	it("returns byte-identical instructions for orientation and config on no-brain-aide branch", async () => {
		mockBuildBrainState.mockResolvedValue({ status: "no-brain-aide", hints: [] });

		const orientationResult = await brain("/root", { kind: "orientation" });
		const configResult = await brain("/root", { kind: "config" });

		expect(orientationResult.status).toBe(configResult.status);
		expect(orientationResult.instructions).toBe(configResult.instructions);
	});

	it("never calls parseBrainAide on the no-brain-aide branch regardless of kind", async () => {
		mockBuildBrainState.mockResolvedValue({ status: "no-brain-aide", hints: [] });

		await brain("/root", { kind: "orientation" });
		await brain("/root", { kind: "config" });

		expect(mockParseBrainAide).not.toHaveBeenCalled();
	});
});

describe("brain — no-mcp-entry: remediation prose", () => {
	it("returns status no-mcp-entry with prose containing npx aidemd-mcp sync", async () => {
		mockBuildBrainState.mockResolvedValue({
			status: "no-mcp-entry",
			name: "obsidian",
			hints: [],
		});

		const result = await brain("/root");

		expect(result.status).toBe("no-mcp-entry");
		// Load-bearing phrase: sync is the only recovery command for a missing entry.
		expect(result.instructions).toContain("npx aidemd-mcp sync");
	});

	it("returns byte-identical instructions for orientation and config on no-mcp-entry branch", async () => {
		mockBuildBrainState.mockResolvedValue({ status: "no-mcp-entry", name: "obsidian", hints: [] });

		const orientationResult = await brain("/root", { kind: "orientation" });
		const configResult = await brain("/root", { kind: "config" });

		expect(orientationResult.status).toBe(configResult.status);
		expect(orientationResult.instructions).toBe(configResult.instructions);
	});

	it("never calls parseBrainAide on the no-mcp-entry branch regardless of kind", async () => {
		mockBuildBrainState.mockResolvedValue({ status: "no-mcp-entry", name: "obsidian", hints: [] });

		await brain("/root", { kind: "orientation" });
		await brain("/root", { kind: "config" });

		expect(mockParseBrainAide).not.toHaveBeenCalled();
	});
});

describe("brain — mcp-drift: remediation prose", () => {
	it("returns status mcp-drift with prose containing sync command and drift mention", async () => {
		mockBuildBrainState.mockResolvedValue({
			status: "mcp-drift",
			name: "obsidian",
			hints: [],
		});

		const result = await brain("/root");

		expect(result.status).toBe("mcp-drift");
		// Load-bearing phrases: sync is the recovery command; prose must name drift.
		expect(result.instructions).toContain("npx aidemd-mcp sync");
		expect(result.instructions.toLowerCase()).toContain("disagree");
	});

	it("returns byte-identical instructions for orientation and config on mcp-drift branch", async () => {
		mockBuildBrainState.mockResolvedValue({ status: "mcp-drift", name: "obsidian", hints: [] });

		const orientationResult = await brain("/root", { kind: "orientation" });
		const configResult = await brain("/root", { kind: "config" });

		expect(orientationResult.status).toBe(configResult.status);
		expect(orientationResult.instructions).toBe(configResult.instructions);
	});

	it("never calls parseBrainAide on the mcp-drift branch regardless of kind", async () => {
		mockBuildBrainState.mockResolvedValue({ status: "mcp-drift", name: "obsidian", hints: [] });

		await brain("/root", { kind: "orientation" });
		await brain("/root", { kind: "config" });

		expect(mockParseBrainAide).not.toHaveBeenCalled();
	});
});

// ---------------------------------------------------------------------------
// Step 8a-8b. Defensive fallback — parseBrainAide non-ok despite ok state, both kinds
// ---------------------------------------------------------------------------

describe("brain — defensive fallback: parseBrainAide non-ok", () => {
	it.each(["orientation", "config"] as const)(
		"returns no-brain-aide with non-empty instructions on kind=%s when parseBrainAide returns missing",
		async (kind) => {
			// Simulate the upstream contract violation: buildBrainState says ok but
			// parseBrainAide returns missing (e.g. file deleted between the two calls).
			mockBuildBrainState.mockResolvedValue(makeOkState());
			mockParseBrainAide.mockResolvedValue({ kind: "missing" });

			const result = await brain("/root", { kind });

			expect(result.status).toBe("no-brain-aide");
			expect(result.instructions.length).toBeGreaterThan(0);
			expect(result.instructions).toContain("npx aidemd-mcp init");
		},
	);

	it.each(["orientation", "config"] as const)(
		"returns no-brain-aide on kind=%s when parseBrainAide returns malformed-frontmatter",
		async (kind) => {
			mockBuildBrainState.mockResolvedValue(makeOkState());
			mockParseBrainAide.mockResolvedValue({
				kind: "malformed-frontmatter",
				reason: "required field name is missing",
			});

			const result = await brain("/root", { kind });

			expect(result.status).toBe("no-brain-aide");
			expect(result.instructions.length).toBeGreaterThan(0);
			expect(result.instructions).toContain("npx aidemd-mcp init");
		},
	);

	// Step 8b — third non-ok parser kind: malformed-body
	it.each(["orientation", "config"] as const)(
		"returns no-brain-aide on kind=%s when parseBrainAide returns malformed-body",
		async (kind) => {
			mockBuildBrainState.mockResolvedValue(makeOkState());
			mockParseBrainAide.mockResolvedValue({
				kind: "malformed-body",
				reason: "missing markers: <!-- aide-orientation-start -->, <!-- aide-orientation-end -->",
			});

			const result = await brain("/root", { kind });

			expect(result.status).toBe("no-brain-aide");
			expect(result.instructions.length).toBeGreaterThan(0);
			expect(result.instructions).toContain("npx aidemd-mcp init");
		},
	);
});

// ---------------------------------------------------------------------------
// Step 9a-9b. instructions always non-empty — (state × kind) matrix
// ---------------------------------------------------------------------------

describe("brain — instructions always non-empty", () => {
	it.each([
		["no-brain-aide", { status: "no-brain-aide" as const, hints: [] }],
		["no-mcp-entry", { status: "no-mcp-entry" as const, name: "obsidian", hints: [] }],
		["mcp-drift", { status: "mcp-drift" as const, name: "obsidian", hints: [] }],
	])(
		"instructions is non-empty on %s branch (both kinds)",
		async (_label, state) => {
			for (const kind of ["orientation", "config"] as const) {
				mockBuildBrainState.mockResolvedValue(state);

				const result = await brain("/root", { kind });

				expect(result.instructions.length).toBeGreaterThan(0);
			}
		},
	);

	// Step 9b — ok cell: both kind values produce non-empty instructions
	it("instructions is non-empty on ok orientation branch", async () => {
		mockBuildBrainState.mockResolvedValue(makeOkState());
		mockParseBrainAide.mockResolvedValue(makeOkParseResult({ orientation: "non-empty orientation" }));

		const result = await brain("/root", { kind: "orientation" });

		expect(result.instructions.length).toBeGreaterThan(0);
	});

	it("instructions is non-empty on ok config branch", async () => {
		mockBuildBrainState.mockResolvedValue(makeOkState());
		mockParseBrainAide.mockResolvedValue(makeOkParseResult({ config: "non-empty config" }));

		const result = await brain("/root", { kind: "config" });

		expect(result.instructions.length).toBeGreaterThan(0);
	});

	it("instructions is non-empty on the defensive fallback branch (orientation)", async () => {
		mockBuildBrainState.mockResolvedValue(makeOkState());
		mockParseBrainAide.mockResolvedValue({ kind: "missing" });

		const result = await brain("/root", { kind: "orientation" });

		expect(result.status).toBe("no-brain-aide");
		expect(result.instructions.length).toBeGreaterThan(0);
	});

	it("instructions is non-empty on the defensive fallback branch (config)", async () => {
		mockBuildBrainState.mockResolvedValue(makeOkState());
		mockParseBrainAide.mockResolvedValue({ kind: "missing" });

		const result = await brain("/root", { kind: "config" });

		expect(result.status).toBe("no-brain-aide");
		expect(result.instructions.length).toBeGreaterThan(0);
	});
});

// ---------------------------------------------------------------------------
// Step 10. BrainInput schema — vocabulary enforcement
// ---------------------------------------------------------------------------

describe("BrainInput schema rejects seed-section spellings", () => {
	// Step 10a — each seed spelling must be rejected
	it.each([
		"playbookIndex",
		"playbook-index",
		"studyPlaybook",
		"study-playbook",
		"updatePlaybook",
		"update-playbook",
		"researchIndex",
		"research-index",
	])('rejects kind: "%s"', (spelling) => {
		expect(BrainInput.safeParse({ kind: spelling }).success).toBe(false);
	});

	// Step 10b — the three accepted values
	it('accepts kind: "orientation"', () => {
		expect(BrainInput.safeParse({ kind: "orientation" }).success).toBe(true);
	});

	it('accepts kind: "config"', () => {
		expect(BrainInput.safeParse({ kind: "config" }).success).toBe(true);
	});

	it("accepts omitted kind (empty object)", () => {
		expect(BrainInput.safeParse({}).success).toBe(true);
	});

	// Step 10c — unknown-but-not-seed values are rejected at the schema boundary
	it('rejects kind: "banana" (unknown value)', () => {
		expect(BrainInput.safeParse({ kind: "banana" }).success).toBe(false);
	});

	it('rejects kind: "" (empty string)', () => {
		expect(BrainInput.safeParse({ kind: "" }).success).toBe(false);
	});
});
