/**
 * Tests for brain tool — BrainState-contract branching, verbatim-bytes invariants,
 * and the `found` / `purpose` response keys.
 *
 * Branches covered: one describe block per BrainState status (`ok`, `no-brain-aide`,
 * `brain-aide-invalid`, `no-mcp-entry`, `mcp-drift`) plus the defensive-fallback path. Tests are written
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
import brainContract from "@/service/brainContract/index.js";
import type { BrainSectionMarker } from "@/service/brainContract/index.js";
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

/** no-mcp-entry / mcp-drift state fixture. */
function makeWiringState(status: "no-mcp-entry" | "mcp-drift") {
	return { status, name: "obsidian", hints: [] };
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

/** Section markers drawn from the published contract, never hand-typed. */
const CONTRACT_MARKERS = brainContract.map((entry) => entry.marker);
const MISSING_MARKERS = CONTRACT_MARKERS.slice(-2);

/** A seed marker (the first non-live entry) used where one seed case is enough. */
const SEED_MARKER: BrainSectionMarker = brainContract.find((entry) => entry.role === "seed")!.marker;

/** Contract purpose for a marker, read straight from the published contract. */
function contractPurpose(marker: BrainSectionMarker): string {
	return brainContract.find((entry) => entry.marker === marker)!.purpose;
}

/**
 * Verbatim bytes for one contract field. Includes `${...}`, CRLF and
 * leading/trailing blank lines so a transforming pass would be caught.
 */
function verbatimBytes(field: string): string {
	return `\r\n\r\n${field} section with literal \${rootPath}\r\nand [[${field}-reference]]\r\n\r\n`;
}

/**
 * Ok parse result fixture with every contract field populated from
 * `brainContract` (not hand-listed). `orientation` and `config` can be overridden.
 */
function makeOkParseResult(overrides: { orientation?: string; config?: string } = {}) {
	const fields = Object.fromEntries(brainContract.map((entry) => [entry.field, verbatimBytes(entry.field)]));
	return {
		kind: "ok" as const,
		name: "obsidian",
		mcpServerConfig: MINIMAL_CONFIG.mcpServerConfig,
		...fields,
		orientation: overrides.orientation ?? VERBATIM_ORIENTATION,
		config: overrides.config ?? VERBATIM_CONFIG,
	};
}

/** Field name of a contract marker. */
function fieldOf(marker: BrainSectionMarker): string {
	return brainContract.find((entry) => entry.marker === marker)!.field;
}

/**
 * missing-sections parse fixture: `sections` are absent, every other contract
 * field is present with verbatim bytes (orientation and config fixed).
 */
function makeMissingSectionsParse(sections: string[] = MISSING_MARKERS) {
	const present: Record<string, string> = {};
	for (const entry of brainContract) {
		if (sections.includes(entry.marker)) continue;
		present[entry.field] = verbatimBytes(entry.field);
	}
	if (!sections.includes("orientation")) present.orientation = VERBATIM_ORIENTATION;
	if (!sections.includes("config")) present.config = VERBATIM_CONFIG;
	return {
		kind: "missing-sections" as const,
		sections,
		name: "obsidian",
		mcpServerConfig: MINIMAL_CONFIG.mcpServerConfig,
		present,
	};
}

/** Malformed reason fixture; the composer must carry it verbatim. */
const MALFORMED_REASON = "required field name is missing";

/** brain-aide-invalid state fixture carrying a missing-sections fault. */
function makeMissingSectionsState(sections: string[] = MISSING_MARKERS) {
	return {
		status: "brain-aide-invalid" as const,
		fault: { kind: "missing-sections" as const, sections },
		hints: [],
	};
}

/** brain-aide-invalid state fixture carrying a malformed fault. */
function makeMalformedState(reason = MALFORMED_REASON) {
	return {
		status: "brain-aide-invalid" as const,
		fault: { kind: "malformed" as const, reason },
		hints: [],
	};
}

/** The absent-file sentence; it must never describe a present-but-invalid file. */
const ABSENT_SENTENCE = "No `.aide/config/brain.aide` is present";

/** Exact brief #14 missing-sections text for a list of markers. */
function missingSectionsText(sections: string[]): string {
	return `\`.aide/config/brain.aide\` is missing required sections: ${sections.join(", ")}. With the user's consent, call \`aide_upgrade\` with \`category: "brain"\` — it inserts only the missing sections and leaves every existing section untouched — then re-check brain state with \`aide_info\`.`;
}

/** Exact brief #14 malformed text for a reason. */
function malformedText(reason: string): string {
	return `\`.aide/config/brain.aide\` exists but is malformed: ${reason}. Fix it by hand with the user at the place that reason names, then re-check brain state with \`aide_info\`. Do not proceed with this task as if the brain were available.`;
}

const FOUND_KEYS = ["found", "instructions", "purpose", "status"];
const NOT_FOUND_KEYS = ["found", "instructions", "status"];

// ---------------------------------------------------------------------------
// Test setup
// ---------------------------------------------------------------------------

beforeEach(() => {
	vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// ok — orientation kind (default and explicit)
// ---------------------------------------------------------------------------

describe("brain — ok: orientation kind", () => {
	it("returns VERBATIM_ORIENTATION with found and purpose when called with no input (default kind)", async () => {
		mockBuildBrainState.mockResolvedValue(makeOkState());
		mockParseBrainAide.mockResolvedValue(makeOkParseResult());

		const result = await brain("/root");

		expect(result.instructions).toBe(VERBATIM_ORIENTATION);
		expect(result.found).toBe(true);
		expect(result.purpose).toBe(contractPurpose("orientation"));
	});

	it("returns VERBATIM_ORIENTATION with found and purpose when called with kind: orientation (explicit)", async () => {
		mockBuildBrainState.mockResolvedValue(makeOkState());
		mockParseBrainAide.mockResolvedValue(makeOkParseResult());

		const result = await brain("/root", { kind: "orientation" });

		expect(result.instructions).toBe(VERBATIM_ORIENTATION);
		expect(result.found).toBe(true);
		expect(result.purpose).toBe(contractPurpose("orientation"));
	});

	it("NEVER returns VERBATIM_CONFIG on the orientation path (cross-section bleed-through)", async () => {
		mockBuildBrainState.mockResolvedValue(makeOkState());
		mockParseBrainAide.mockResolvedValue(makeOkParseResult());

		const result = await brain("/root");

		expect(result.instructions).not.toBe(VERBATIM_CONFIG);
	});
});

// ---------------------------------------------------------------------------
// ok — config kind
// ---------------------------------------------------------------------------

describe("brain — ok: config kind", () => {
	it("returns VERBATIM_CONFIG with found and purpose when called with kind: config", async () => {
		mockBuildBrainState.mockResolvedValue(makeOkState());
		mockParseBrainAide.mockResolvedValue(makeOkParseResult());

		const result = await brain("/root", { kind: "config" });

		expect(result.instructions).toBe(VERBATIM_CONFIG);
		expect(result.found).toBe(true);
		expect(result.purpose).toBe(contractPurpose("config"));
	});

	it("NEVER returns VERBATIM_ORIENTATION on the config path (cross-section bleed-through)", async () => {
		mockBuildBrainState.mockResolvedValue(makeOkState());
		mockParseBrainAide.mockResolvedValue(makeOkParseResult());

		const result = await brain("/root", { kind: "config" });

		expect(result.instructions).not.toBe(VERBATIM_ORIENTATION);
	});
});

// ---------------------------------------------------------------------------
// ok — every contract marker returns its own field's bytes
// ---------------------------------------------------------------------------

describe("brain — ok: every contract marker", () => {
	it.each(CONTRACT_MARKERS)("returns the %s section's bytes untouched with found and purpose", async (marker) => {
		const parse = makeOkParseResult();
		mockBuildBrainState.mockResolvedValue(makeOkState());
		mockParseBrainAide.mockResolvedValue(parse);

		const result = await brain("/root", { kind: marker });

		expect(result.instructions).toBe((parse as Record<string, unknown>)[fieldOf(marker)]);
		expect(result.found).toBe(true);
		expect(result.purpose).toBe(contractPurpose(marker));
	});
});

// ---------------------------------------------------------------------------
// No substitution on either kind — ${...} sequences preserved verbatim
// ---------------------------------------------------------------------------

describe("brain — no substitution on either kind", () => {
	it("preserves literal ${...} sequences byte-identical in orientation", async () => {
		const orientationWithPlaceholder = "orientation: ${PLACEHOLDER_A} and ${PLACEHOLDER_B}";
		mockBuildBrainState.mockResolvedValue(makeOkState());
		mockParseBrainAide.mockResolvedValue(makeOkParseResult({ orientation: orientationWithPlaceholder }));

		const result = await brain("/root", { kind: "orientation" });

		expect(result.instructions).toBe(orientationWithPlaceholder);
		expect(result.found).toBe(true);
		expect(result.purpose).toBe(contractPurpose("orientation"));
	});

	it("preserves literal ${...} sequences byte-identical in config", async () => {
		const configWithPlaceholder = "config: ${PLACEHOLDER_C} and ${PLACEHOLDER_D}";
		mockBuildBrainState.mockResolvedValue(makeOkState());
		mockParseBrainAide.mockResolvedValue(makeOkParseResult({ config: configWithPlaceholder }));

		const result = await brain("/root", { kind: "config" });

		expect(result.instructions).toBe(configWithPlaceholder);
		expect(result.found).toBe(true);
		expect(result.purpose).toBe(contractPurpose("config"));
	});
});

// ---------------------------------------------------------------------------
// Response shape — exact key sets, no `name`, `backend`, `connector`, or `kind`
// ---------------------------------------------------------------------------

describe("brain — no name, backend, connector, or kind field on response", () => {
	it.each([
		["orientation (default)", undefined],
		["orientation", { kind: "orientation" as const }],
		["config", { kind: "config" as const }],
		[SEED_MARKER, { kind: SEED_MARKER }],
	])("responds with exactly found, instructions, purpose and status on the found branch (%s)", async (_label, input) => {
		mockBuildBrainState.mockResolvedValue(makeOkState());
		mockParseBrainAide.mockResolvedValue(makeOkParseResult());

		const result = await brain("/root", input);

		expect(Object.keys(result).sort()).toEqual(FOUND_KEYS);
		expect(result).not.toHaveProperty("backend");
		expect(result).not.toHaveProperty("name");
		expect(result).not.toHaveProperty("connector");
		expect(result).not.toHaveProperty("kind");
	});

	it("responds with exactly found, instructions and status on a non-ok branch", async () => {
		mockBuildBrainState.mockResolvedValue({ status: "no-brain-aide", hints: [] });

		const result = await brain("/root");

		expect(Object.keys(result).sort()).toEqual(NOT_FOUND_KEYS);
		expect(result).not.toHaveProperty("name");
		expect(result).not.toHaveProperty("backend");
		expect(result).not.toHaveProperty("connector");
	});
});

// ---------------------------------------------------------------------------
// No name dispatch — ok branch output is identical across names, for both kinds
// ---------------------------------------------------------------------------

describe("brain — no name dispatch", () => {
	it("returns byte-identical results for obsidian and notion on orientation kind", async () => {
		const orientationText = "identical orientation for both names";

		mockBuildBrainState.mockResolvedValue(makeOkState("obsidian"));
		mockParseBrainAide.mockResolvedValue(makeOkParseResult({ orientation: orientationText }));
		const obsidianResult = await brain("/root", { kind: "orientation" });

		mockBuildBrainState.mockResolvedValue(makeOkState("notion"));
		mockParseBrainAide.mockResolvedValue(makeOkParseResult({ orientation: orientationText }));
		const notionResult = await brain("/root", { kind: "orientation" });

		expect(Object.keys(obsidianResult).sort()).toEqual(FOUND_KEYS);
		expect(obsidianResult).toEqual(notionResult);
	});

	it("returns byte-identical results for obsidian and notion on config kind", async () => {
		const configText = "identical config for both names";

		mockBuildBrainState.mockResolvedValue(makeOkState("obsidian"));
		mockParseBrainAide.mockResolvedValue(makeOkParseResult({ config: configText }));
		const obsidianResult = await brain("/root", { kind: "config" });

		mockBuildBrainState.mockResolvedValue(makeOkState("notion"));
		mockParseBrainAide.mockResolvedValue(makeOkParseResult({ config: configText }));
		const notionResult = await brain("/root", { kind: "config" });

		expect(Object.keys(obsidianResult).sort()).toEqual(FOUND_KEYS);
		expect(obsidianResult).toEqual(notionResult);
	});
});

// ---------------------------------------------------------------------------
// no-brain-aide
// ---------------------------------------------------------------------------

describe("brain — no-brain-aide: remediation prose", () => {
	it("returns status no-brain-aide with prose routing to /aide:brain config and found: false", async () => {
		mockBuildBrainState.mockResolvedValue({ status: "no-brain-aide", hints: [] });

		const result = await brain("/root");

		expect(result.status).toBe("no-brain-aide");
		expect(result.found).toBe(false);
		// Load-bearing phrase: the agent must surface the config command, not the retired CLI init.
		expect(result.instructions).toContain("/aide:brain config");
		expect(result.instructions).not.toContain("init");
	});

	it("returns byte-identical results for orientation and config on no-brain-aide branch", async () => {
		mockBuildBrainState.mockResolvedValue({ status: "no-brain-aide", hints: [] });

		const orientationResult = await brain("/root", { kind: "orientation" });
		const configResult = await brain("/root", { kind: "config" });

		expect(orientationResult).toEqual(configResult);
	});

	it("never calls parseBrainAide on the no-brain-aide branch regardless of kind", async () => {
		mockBuildBrainState.mockResolvedValue({ status: "no-brain-aide", hints: [] });

		await brain("/root", { kind: "orientation" });
		await brain("/root", { kind: "config" });

		expect(mockParseBrainAide).not.toHaveBeenCalled();
	});
});

// ---------------------------------------------------------------------------
// brain-aide-invalid
// ---------------------------------------------------------------------------

describe("brain — brain-aide-invalid: remediation prose", () => {
	it("returns the missing-sections remediation with found: false when the requested marker is missing", async () => {
		const requested = MISSING_MARKERS[0];
		mockBuildBrainState.mockResolvedValue(makeMissingSectionsState());
		mockParseBrainAide.mockResolvedValue(makeMissingSectionsParse());

		const result = await brain("/root", { kind: requested });

		expect(result.status).toBe("brain-aide-invalid");
		expect(result.found).toBe(false);
		expect(result.instructions).toBe(missingSectionsText(MISSING_MARKERS));
		expect(result.instructions).not.toContain("/aide:brain config");
		expect(Object.keys(result).sort()).toEqual(NOT_FOUND_KEYS);
	});

	it("returns a present section's bytes with found: true and the status unchanged when the requested marker is present", async () => {
		const parse = makeMissingSectionsParse();
		mockBuildBrainState.mockResolvedValue(makeMissingSectionsState());
		mockParseBrainAide.mockResolvedValue(parse);

		const result = await brain("/root", { kind: "config" });

		expect(result.status).toBe("brain-aide-invalid");
		expect(result.found).toBe(true);
		expect(result.instructions).toBe(VERBATIM_CONFIG);
		expect(result.purpose).toBe(contractPurpose("config"));
		expect(Object.keys(result).sort()).toEqual(FOUND_KEYS);
	});

	it("returns orientation by default when orientation is present", async () => {
		mockBuildBrainState.mockResolvedValue(makeMissingSectionsState());
		mockParseBrainAide.mockResolvedValue(makeMissingSectionsParse());

		const result = await brain("/root");

		expect(result.status).toBe("brain-aide-invalid");
		expect(result.found).toBe(true);
		expect(result.instructions).toBe(VERBATIM_ORIENTATION);
		expect(result.purpose).toBe(contractPurpose("orientation"));
	});

	it("returns the malformed remediation with the reason verbatim and found: false", async () => {
		mockBuildBrainState.mockResolvedValue(makeMalformedState());

		const result = await brain("/root");

		expect(result.status).toBe("brain-aide-invalid");
		expect(result.found).toBe(false);
		expect(result.instructions).toBe(malformedText(MALFORMED_REASON));
		expect(result.instructions).not.toContain("/aide:brain config");
		expect(Object.keys(result).sort()).toEqual(NOT_FOUND_KEYS);
	});

	it("returns byte-identical malformed remediation for orientation and config", async () => {
		mockBuildBrainState.mockResolvedValue(makeMalformedState());

		const orientationResult = await brain("/root", { kind: "orientation" });
		const configResult = await brain("/root", { kind: "config" });

		expect(orientationResult).toEqual(configResult);
	});

	it.each([
		["missing-sections", makeMissingSectionsState(), makeMissingSectionsParse()],
		["malformed", makeMalformedState(), undefined],
	])("never calls a present file absent on a %s fault", async (_label, state, parse) => {
		mockBuildBrainState.mockResolvedValue(state);
		mockParseBrainAide.mockResolvedValue(parse);

		const result = await brain("/root", { kind: MISSING_MARKERS[0] });

		expect(result.instructions).not.toContain(ABSENT_SENTENCE);
	});

	it("never calls parseBrainAide on a malformed fault regardless of kind", async () => {
		mockBuildBrainState.mockResolvedValue(makeMalformedState());

		await brain("/root", { kind: "orientation" });
		await brain("/root", { kind: "config" });

		expect(mockParseBrainAide).not.toHaveBeenCalled();
	});

	it("calls parseBrainAide exactly once on a missing-sections fault", async () => {
		mockBuildBrainState.mockResolvedValue(makeMissingSectionsState());
		mockParseBrainAide.mockResolvedValue(makeMissingSectionsParse());

		await brain("/root", { kind: "orientation" });

		expect(mockParseBrainAide).toHaveBeenCalledTimes(1);
	});
});

// ---------------------------------------------------------------------------
// no-mcp-entry and mcp-drift — the section is returned, the status is unchanged
// ---------------------------------------------------------------------------

describe.each(["no-mcp-entry", "mcp-drift"] as const)("brain — %s: section read", (status) => {
	it.each([
		["orientation (default)", undefined, VERBATIM_ORIENTATION, "orientation" as const],
		["config", { kind: "config" as const }, VERBATIM_CONFIG, "config" as const],
		[SEED_MARKER, { kind: SEED_MARKER }, verbatimBytes(fieldOf(SEED_MARKER)), SEED_MARKER],
	])("returns the requested section verbatim with found: true and the status unchanged (%s)", async (_label, input, bytes, marker) => {
		mockBuildBrainState.mockResolvedValue(makeWiringState(status));
		mockParseBrainAide.mockResolvedValue(makeOkParseResult());

		const result = await brain("/root", input);

		expect(result.status).toBe(status);
		expect(result.found).toBe(true);
		expect(result.instructions).toBe(bytes);
		expect(result.purpose).toBe(contractPurpose(marker));
		expect(Object.keys(result).sort()).toEqual(FOUND_KEYS);
	});

	it("calls parseBrainAide exactly once", async () => {
		mockBuildBrainState.mockResolvedValue(makeWiringState(status));
		mockParseBrainAide.mockResolvedValue(makeOkParseResult());

		await brain("/root", { kind: "config" });

		expect(mockParseBrainAide).toHaveBeenCalledTimes(1);
	});
});

// ---------------------------------------------------------------------------
// Defensive fallback — parseBrainAide non-ok despite ok state, both kinds
// ---------------------------------------------------------------------------

describe("brain — defensive fallback: parseBrainAide non-ok", () => {
	it.each(["orientation", "config"] as const)(
		"returns no-brain-aide routing to /aide:brain config with found: false on kind=%s when parseBrainAide returns missing",
		async (kind) => {
			// Simulate the upstream contract violation: buildBrainState says ok but
			// parseBrainAide returns missing (e.g. file deleted between the two calls).
			mockBuildBrainState.mockResolvedValue(makeOkState());
			mockParseBrainAide.mockResolvedValue({ kind: "missing" });

			const result = await brain("/root", { kind });

			expect(result.status).toBe("no-brain-aide");
			expect(result.found).toBe(false);
			expect(result.instructions.length).toBeGreaterThan(0);
			expect(result.instructions).toContain("/aide:brain config");
			expect(result.instructions).toContain(ABSENT_SENTENCE);
		},
	);

	it.each(["orientation", "config"] as const)(
		"returns brain-aide-invalid naming the missing sections with found: false on kind=%s when parseBrainAide returns missing-sections",
		async (kind) => {
			mockBuildBrainState.mockResolvedValue(makeOkState());
			mockParseBrainAide.mockResolvedValue({
				kind: "missing-sections",
				sections: MISSING_MARKERS,
				name: "obsidian",
				mcpServerConfig: { command: "npx", args: ["-y", "pkg@1.0.0", null] },
				present: {},
			});

			const result = await brain("/root", { kind });

			expect(result.status).toBe("brain-aide-invalid");
			expect(result.found).toBe(false);
			expect(result.instructions).toBe(missingSectionsText(MISSING_MARKERS));
			expect(result.instructions).not.toContain(ABSENT_SENTENCE);
			expect(result.instructions).not.toContain("pkg@1.0.0");
		},
	);

	it.each(["orientation", "config"] as const)(
		"returns brain-aide-invalid carrying the reason with found: false on kind=%s when parseBrainAide returns malformed-frontmatter",
		async (kind) => {
			mockBuildBrainState.mockResolvedValue(makeOkState());
			mockParseBrainAide.mockResolvedValue({
				kind: "malformed-frontmatter",
				reason: MALFORMED_REASON,
			});

			const result = await brain("/root", { kind });

			expect(result.status).toBe("brain-aide-invalid");
			expect(result.found).toBe(false);
			expect(result.instructions).toContain(`exists but is malformed: ${MALFORMED_REASON}.`);
			expect(result.instructions).not.toContain(ABSENT_SENTENCE);
		},
	);

	it.each(["orientation", "config"] as const)(
		"returns brain-aide-invalid naming the read error, never 'not present', with found: false on kind=%s when parseBrainAide returns unreadable",
		async (kind) => {
			const reason = "cannot read .aide/config/brain.aide: permission denied (EACCES)";
			mockBuildBrainState.mockResolvedValue(makeOkState());
			mockParseBrainAide.mockResolvedValue({ kind: "unreadable", reason });

			const result = await brain("/root", { kind });

			expect(result.status).toBe("brain-aide-invalid");
			expect(result.found).toBe(false);
			expect(result.instructions).toContain(reason);
			expect(result.instructions).not.toContain(ABSENT_SENTENCE);
			expect(result.instructions).not.toContain("not present");
		},
	);

	it.each(["orientation", "config"] as const)(
		"returns brain-aide-invalid carrying the reason with found: false on kind=%s when parseBrainAide returns malformed-body",
		async (kind) => {
			const reason = "unbalanced markers: <!-- aide-orientation-start -->";
			mockBuildBrainState.mockResolvedValue(makeOkState());
			mockParseBrainAide.mockResolvedValue({ kind: "malformed-body", reason });

			const result = await brain("/root", { kind });

			expect(result.status).toBe("brain-aide-invalid");
			expect(result.found).toBe(false);
			expect(result.instructions).toContain(`exists but is malformed: ${reason}.`);
			expect(result.instructions).not.toContain(ABSENT_SENTENCE);
		},
	);
});

// ---------------------------------------------------------------------------
// purpose comes from the published contract
// ---------------------------------------------------------------------------

describe("brain — purpose comes from the published contract", () => {
	it.each([
		["orientation (default)", undefined, "orientation" as const],
		["config", { kind: "config" as const }, "config" as const],
		[SEED_MARKER, { kind: SEED_MARKER }, SEED_MARKER],
	])("equals the contract entry's purpose on ok for %s", async (_label, input, marker) => {
		mockBuildBrainState.mockResolvedValue(makeOkState());
		mockParseBrainAide.mockResolvedValue(makeOkParseResult());

		const result = await brain("/root", input);

		expect(result.purpose).toBe(contractPurpose(marker));
	});

	it("equals the contract entry's purpose for a present marker on a missing-sections parse", async () => {
		mockBuildBrainState.mockResolvedValue(makeMissingSectionsState());
		mockParseBrainAide.mockResolvedValue(makeMissingSectionsParse());

		const result = await brain("/root", { kind: "config" });

		expect(result.found).toBe(true);
		expect(result.purpose).toBe(contractPurpose("config"));
	});

	it.each(["no-mcp-entry", "mcp-drift"] as const)("equals the contract entry's purpose on %s", async (status) => {
		mockBuildBrainState.mockResolvedValue(makeWiringState(status));
		mockParseBrainAide.mockResolvedValue(makeOkParseResult());

		const result = await brain("/root", { kind: SEED_MARKER });

		expect(result.purpose).toBe(contractPurpose(SEED_MARKER));
	});

	it("is still the contract string when the user's section text carries a purpose-looking line", async () => {
		const decoy = "purpose: the user's own redefinition of this section\nmore text";
		mockBuildBrainState.mockResolvedValue(makeOkState());
		mockParseBrainAide.mockResolvedValue({ ...makeOkParseResult({ orientation: decoy }), purpose: "frontmatter purpose decoy" });

		const result = await brain("/root", { kind: "orientation" });

		expect(result.instructions).toBe(decoy);
		expect(result.purpose).toBe(contractPurpose("orientation"));
		expect(result.purpose).not.toContain("redefinition");
		expect(result.purpose).not.toContain("decoy");
	});

	it.each([
		["no-brain-aide", async () => {
			mockBuildBrainState.mockResolvedValue({ status: "no-brain-aide", hints: [] });
		}],
		["malformed", async () => {
			mockBuildBrainState.mockResolvedValue(makeMalformedState());
		}],
		["requested marker missing", async () => {
			mockBuildBrainState.mockResolvedValue(makeMissingSectionsState());
			mockParseBrainAide.mockResolvedValue(makeMissingSectionsParse(["orientation"]));
		}],
		["defensive fallback (absent)", async () => {
			mockBuildBrainState.mockResolvedValue(makeOkState());
			mockParseBrainAide.mockResolvedValue({ kind: "missing" });
		}],
		["defensive fallback (malformed)", async () => {
			mockBuildBrainState.mockResolvedValue(makeOkState());
			mockParseBrainAide.mockResolvedValue({ kind: "malformed-body", reason: "bad markers" });
		}],
	])("has no purpose key on the %s branch", async (_label, arrange) => {
		await arrange();

		const result = await brain("/root");

		expect(result.found).toBe(false);
		expect("purpose" in result).toBe(false);
	});
});

// ---------------------------------------------------------------------------
// instructions always non-empty — (state × kind) matrix
// ---------------------------------------------------------------------------

describe("brain — instructions always non-empty", () => {
	it.each([
		["no-brain-aide", { status: "no-brain-aide" as const, hints: [] }],
		["brain-aide-invalid (missing-sections)", makeMissingSectionsState()],
		["brain-aide-invalid (malformed)", makeMalformedState()],
		["no-mcp-entry", makeWiringState("no-mcp-entry")],
		["mcp-drift", makeWiringState("mcp-drift")],
	])(
		"instructions is non-empty on %s branch (orientation, config and a seed marker)",
		async (_label, state) => {
			for (const kind of ["orientation", "config", SEED_MARKER] as const) {
				mockBuildBrainState.mockResolvedValue(state);
				mockParseBrainAide.mockResolvedValue(makeMissingSectionsParse());

				const result = await brain("/root", { kind });

				expect(result.instructions.length).toBeGreaterThan(0);
			}
		},
	);

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

	it("instructions is non-empty on ok seed-marker branch", async () => {
		mockBuildBrainState.mockResolvedValue(makeOkState());
		mockParseBrainAide.mockResolvedValue(makeOkParseResult());

		const result = await brain("/root", { kind: SEED_MARKER });

		expect(result.instructions.length).toBeGreaterThan(0);
	});

	it("instructions is non-empty on the missing-sections remediation branch", async () => {
		mockBuildBrainState.mockResolvedValue(makeMissingSectionsState());
		mockParseBrainAide.mockResolvedValue(makeMissingSectionsParse());

		const result = await brain("/root", { kind: MISSING_MARKERS[0] });

		expect(result.found).toBe(false);
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
// One parse per call, no cache across calls
// ---------------------------------------------------------------------------

describe("brain — one parse per call", () => {
	it("calls parseBrainAide once per call across two consecutive calls", async () => {
		mockBuildBrainState.mockResolvedValue(makeOkState());
		mockParseBrainAide.mockResolvedValue(makeOkParseResult());

		await brain("/root", { kind: "config" });
		expect(mockParseBrainAide).toHaveBeenCalledTimes(1);

		await brain("/root", { kind: "config" });
		expect(mockParseBrainAide).toHaveBeenCalledTimes(2);
	});
});

// ---------------------------------------------------------------------------
// BrainInput schema — vocabulary enforcement
// ---------------------------------------------------------------------------

describe("BrainInput schema accepts exactly the contract markers", () => {
	it.each(CONTRACT_MARKERS)('accepts kind: "%s"', (marker) => {
		expect(BrainInput.safeParse({ kind: marker }).success).toBe(true);
	});

	it("accepts omitted kind (empty object)", () => {
		expect(BrainInput.safeParse({}).success).toBe(true);
	});

	it('rejects kind: "banana" (unknown value)', () => {
		expect(BrainInput.safeParse({ kind: "banana" }).success).toBe(false);
	});

	it('rejects kind: "" (empty string)', () => {
		expect(BrainInput.safeParse({ kind: "" }).success).toBe(false);
	});

	it.each(brainContract.filter((entry) => entry.field !== entry.marker).map((entry) => entry.field))(
		'rejects the camelCase field spelling kind: "%s"',
		(field) => {
			expect(BrainInput.safeParse({ kind: field }).success).toBe(false);
		},
	);
});

// ---------------------------------------------------------------------------
// BrainInput — four modes
// ---------------------------------------------------------------------------

describe("BrainInput — four modes", () => {
	const accepted: [string, unknown][] = [
		["{}", {}],
		...CONTRACT_MARKERS.map((m): [string, unknown] => [`host kind: ${m}`, { kind: m }]),
		...CONTRACT_MARKERS.map((m): [string, unknown] => [`explicit host kind: ${m}`, { source: "host", kind: m }]),
		["template with no kind", { source: "template" }],
		...CONTRACT_MARKERS.map((m): [string, unknown] => [`template kind: ${m}`, { source: "template", kind: m }]),
		["template kind: launcher", { source: "template", kind: "launcher" }],
		["contract", { source: "contract" }],
		["draft with path", { source: "draft", path: "drafts/brain.aide" }],
	];

	const rejected: [string, unknown][] = [
		["host kind: launcher", { kind: "launcher" }],
		["explicit host kind: launcher", { source: "host", kind: "launcher" }],
		["template kind: banana", { source: "template", kind: "banana" }],
		["contract with kind", { source: "contract", kind: "orientation" }],
		["draft without path", { source: "draft" }],
		["draft with empty path", { source: "draft", path: "" }],
		["draft with kind", { source: "draft", path: "x", kind: "config" }],
		["template with path", { source: "template", path: "x" }],
		["unknown source", { source: "banana" }],
		["host kind with path", { kind: "orientation", path: "x" }],
		["host kind with unknown key", { kind: "orientation", extra: 1 }],
	];

	it.each(accepted)("accepts %s", (_label, input) => {
		expect(BrainInput.safeParse(input).success).toBe(true);
	});

	it.each(rejected)("rejects %s", (_label, input) => {
		expect(BrainInput.safeParse(input).success).toBe(false);
	});

	it("parses {} to {} (no default injected at the schema)", () => {
		expect(BrainInput.parse({})).toEqual({});
	});

	it("parses { kind: config } to { kind: config } (no default injected at the schema)", () => {
		expect(BrainInput.parse({ kind: "config" })).toEqual({ kind: "config" });
	});
});
