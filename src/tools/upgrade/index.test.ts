import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { FrameworkConfig, UpgradeCategoryResult, UpgradeResult } from "@/types/index.js";

// ── Module mocks ─────────────────────────────────────────────────────────────

vi.mock("@/service/install/detectFramework/index.js");
vi.mock("@/service/install/initContent/index.js");
vi.mock("@/service/install/scaffoldCommands/index.js", () => ({
	COMMANDS: [
		{ canonical: "commands/aide/aide", hostPath: "aide.md", displayName: "aide" },
		{ canonical: "commands/aide/research", hostPath: "aide/research.md", displayName: "aide:research" },
	],
}));
vi.mock("./compareFile/index.js");
vi.mock("./spliceStub/index.js");
vi.mock("./buildVersionsMeta/index.js");
vi.mock("./checkMcpConfig/index.js");
vi.mock("./checkIdeConfig/index.js");
vi.mock("@/service/install/scaffoldReadme/index.js");
vi.mock("@/service/parseBrainAide/index.js");

import detectFramework from "@/service/install/detectFramework/index.js";
import { readCanonicalDoc, listMethodologyDocs, listAgents, listSkills } from "@/service/install/initContent/index.js";
import compareFile from "./compareFile/index.js";
import spliceStub from "./spliceStub/index.js";
import readVersionsManifest from "./buildVersionsMeta/index.js";
import checkMcpConfig from "./checkMcpConfig/index.js";
import { checkZedConfig, checkVscodeExtension } from "./checkIdeConfig/index.js";
import scaffoldReadme from "@/service/install/scaffoldReadme/index.js";
import parseBrainAide from "@/service/parseBrainAide/index.js";
import upgrade from "./index.js";

// ── Helpers ───────────────────────────────────────────────────────────────────

const CLAUDE_CONFIG: FrameworkConfig = {
	framework: "claude",
	configPath: "CLAUDE.md",
	commandDir: ".claude/commands",
	mcpConfigPath: ".mcp.json",
	docHubDir: ".aide/docs",
	agentDir: ".claude/agents",
	skillDir: ".claude/skills",
};

const CURSOR_CONFIG: FrameworkConfig = {
	framework: "cursor",
	configPath: ".cursorrules",
	commandDir: ".cursor/commands",
	mcpConfigPath: ".cursor/mcp.json",
	docHubDir: ".aide/docs",
	agentDir: ".cursor/agents",
	skillDir: ".cursor/skills",
};

const MOCK_METHODOLOGY_DOCS = [
	{ canonical: "aide-spec" as const, hostFilename: "aide-spec.md" },
	{ canonical: "aide-template" as const, hostFilename: "aide-template.md" },
];

let tempDir: string;

beforeEach(async () => {
	tempDir = await mkdtemp(join(tmpdir(), "aide-upgrade-"));
	vi.resetAllMocks();
});

afterEach(async () => {
	await rm(tempDir, { recursive: true, force: true });
});

// ── Shared mock wiring ─────────────────────────────────────────────────────────

function wireDefaultMocks(config: FrameworkConfig = CLAUDE_CONFIG) {
	vi.mocked(detectFramework).mockResolvedValue(config);
	vi.mocked(listMethodologyDocs).mockReturnValue(MOCK_METHODOLOGY_DOCS);
	vi.mocked(listAgents).mockReturnValue([]);
	vi.mocked(listSkills).mockReturnValue([]);
	vi.mocked(readCanonicalDoc).mockReturnValue("canonical content");
	vi.mocked(readVersionsManifest).mockReturnValue({
		"aide-spec": { publishedAt: "2026-04-11T14:30:00+00:00", sourceCommit: "abc1234", previousCommit: "def5678" },
		"aide-template": { publishedAt: "2026-03-15T09:00:00+00:00", sourceCommit: "b2c3d4e" },
	});

	// Default: all matching
	vi.mocked(spliceStub).mockResolvedValue({
		name: "Methodology pointer",
		filePath: join(tempDir, "CLAUDE.md"),
		status: "matches",
		category: "pointer-stub",
	});
	vi.mocked(compareFile).mockResolvedValue("matches");
	vi.mocked(checkMcpConfig).mockResolvedValue({
		name: "MCP config",
		filePath: join(tempDir, ".mcp.json"),
		status: "matches",
		category: "mcp",
	});
	vi.mocked(checkZedConfig).mockResolvedValue({
		name: "Zed config",
		filePath: join(tempDir, ".zed", "settings.json"),
		status: "matches",
		category: "ide",
	});
	vi.mocked(checkVscodeExtension).mockResolvedValue({
		name: "VS Code extension",
		filePath: "/path/to/aide-markdown-0.0.1.vsix",
		status: "matches",
		category: "ide",
	});
	vi.mocked(scaffoldReadme).mockResolvedValue({
		name: "README badge",
		filePath: join(tempDir, "README.md"),
		status: "exists",
		category: "readme",
	});
	vi.mocked(parseBrainAide).mockResolvedValue({
		kind: "ok",
		name: "obsidian",
		mcpServerConfig: { command: "x", args: [] },
		orientation: "",
		config: "",
		playbookIndex: "",
		studyPlaybook: "",
		updatePlaybook: "",
		researchIndex: "",
	});
}

// Helper: find a category result by name
function findCategory(result: UpgradeResult, category: string) {
	return result.categories.find((c) => c.category === category);
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("upgrade", () => {
	// ── Test 1: All matching → all category summaries have 0 diffs ──────────
	it("returns all-matching summaries when every artifact matches", async () => {
		wireDefaultMocks();

		const result = await upgrade(tempDir);

		expect(result.framework).toBe("claude");
		expect(result.categories).toHaveLength(10);

		for (const cat of result.categories) {
			expect(cat.summary.differs).toBe(0);
			expect(cat.summary.missing).toBe(0);
		}
	});

	// ── Test 2: Some drifted docs → methodology-docs category reports it ────
	it("reports differs in methodology-docs category when docs have drifted", async () => {
		wireDefaultMocks();

		// First doc differs, second matches, versions match, commands match
		vi.mocked(compareFile)
			.mockResolvedValueOnce("differs")   // aide-spec.md
			.mockResolvedValueOnce("matches")   // aide-template.md
			.mockResolvedValueOnce("matches")   // versions.json
			.mockResolvedValueOnce("matches")   // aide command
			.mockResolvedValueOnce("matches");  // aide:research

		const result = await upgrade(tempDir);

		const docsCat = findCategory(result, "methodology-docs");
		expect(docsCat).toBeDefined();
		expect(docsCat!.summary.differs).toBe(1);
		expect(docsCat!.summary.matches).toBe(1);

		// The differing file has canonicalContent populated
		const differingFile = docsCat!.files.find((f) => f.status === "differs");
		expect(differingFile?.canonicalContent).toBe("canonical content");

		// Other categories should still report all matching
		const cmdsCat = findCategory(result, "commands");
		expect(cmdsCat!.summary.differs).toBe(0);
	});

	// ── Test 3: MCP config malformed → mcp category reports malformed ────────
	it("reports malformed status when MCP config cannot be parsed", async () => {
		wireDefaultMocks();
		vi.mocked(checkMcpConfig).mockResolvedValue({
			name: "MCP config",
			filePath: join(tempDir, ".mcp.json"),
			status: "malformed",
			category: "mcp",
		});

		const result = await upgrade(tempDir);

		const mcpCat = findCategory(result, "mcp");
		expect(mcpCat).toBeDefined();
		expect(mcpCat!.files[0].status).toBe("malformed");
		expect(mcpCat!.files[0].prescription).toBeUndefined();
	});

	// ── Test 4: MCP config differs → prescription carried on the result ──────
	it("includes prescription in mcp category when aide entry differs", async () => {
		wireDefaultMocks();
		const prescription = { key: "aide", entry: { command: "npx", args: ["@aidemd-mcp/server"] } };
		vi.mocked(checkMcpConfig).mockResolvedValue({
			name: "MCP config",
			filePath: join(tempDir, ".mcp.json"),
			status: "differs",
			category: "mcp",
			prescription,
		});

		const result = await upgrade(tempDir);

		const mcpCat = findCategory(result, "mcp");
		expect(mcpCat!.files[0].status).toBe("differs");
		expect(mcpCat!.files[0].prescription).toEqual(prescription);
	});

	// ── Test 5: Missing files → status 'missing' with canonicalContent ───────
	it("populates canonicalContent for missing files", async () => {
		wireDefaultMocks();

		vi.mocked(compareFile)
			.mockResolvedValueOnce("missing")   // aide-spec.md
			.mockResolvedValueOnce("matches")   // aide-template.md
			.mockResolvedValueOnce("matches")   // versions.json
			.mockResolvedValueOnce("matches")   // aide command
			.mockResolvedValueOnce("matches");  // aide:research

		const result = await upgrade(tempDir);

		const docsCat = findCategory(result, "methodology-docs");
		const missingFile = docsCat!.files.find((f) => f.status === "missing");
		expect(missingFile).toBeDefined();
		expect(missingFile!.canonicalContent).toBe("canonical content");
	});

	// ── Test 6: Each file lands in the correct category ─────────────────────
	it("groups files into correct categories", async () => {
		wireDefaultMocks();

		const result = await upgrade(tempDir);

		const categories = result.categories.map((c) => c.category);
		expect(categories).toContain("pointer-stub");
		expect(categories).toContain("methodology-docs");
		expect(categories).toContain("version-metadata");
		expect(categories).toContain("commands");
		expect(categories).toContain("agents");
		expect(categories).toContain("skills");
		expect(categories).toContain("mcp");
		expect(categories).toContain("ide");

		// methodology-docs should have 2 entries (from MOCK_METHODOLOGY_DOCS)
		const docsCat = findCategory(result, "methodology-docs");
		expect(docsCat!.files).toHaveLength(2);

		// pointer-stub should have exactly 1 entry
		const stubCat = findCategory(result, "pointer-stub");
		expect(stubCat!.files).toHaveLength(1);

		// version-metadata should have exactly 1 entry (versions.json)
		const versionCat = findCategory(result, "version-metadata");
		expect(versionCat!.files).toHaveLength(1);
		expect(versionCat!.files[0].name).toContain("versions.json");

		// commands should have 2 entries (from COMMANDS mock)
		const cmdsCat = findCategory(result, "commands");
		expect(cmdsCat!.files).toHaveLength(2);

		// ide should have 1 entry (zed only — vscode extension not yet built)
		const ideCat = findCategory(result, "ide");
		expect(ideCat!.files).toHaveLength(1);

		// brain category must be present with exactly one file
		expect(categories).toContain("brain");
		const brainCat = findCategory(result, "brain");
		expect(brainCat!.files).toHaveLength(1);
		expect(brainCat!.files[0].name).toBe(".aide/config/brain.aide");
		expect(brainCat!.summary.total).toBe(1);
	});

	// ── Test 7: Framework override forwarded to detectFramework ─────────────
	it("forwards framework override to detectFramework", async () => {
		wireDefaultMocks(CURSOR_CONFIG);
		vi.mocked(detectFramework).mockResolvedValue(CURSOR_CONFIG);

		const result = await upgrade(tempDir, "cursor");

		expect(result.framework).toBe("cursor");
		expect(vi.mocked(detectFramework)).toHaveBeenCalledWith(
			expect.any(String),
			"cursor",
		);
	});

	// ── Test 8: No prose in result — structured data only ───────────────────
	it("returns structured UpgradeResult, not a string", async () => {
		wireDefaultMocks();

		const result = await upgrade(tempDir);

		// Must be a proper object with the expected shape
		expect(typeof result).toBe("object");
		expect(result).toHaveProperty("framework");
		expect(result).toHaveProperty("categories");
		expect(Array.isArray(result.categories)).toBe(true);
	});

	// ── Test 9: Summary counts are computed correctly ────────────────────────
	it("computes summary totals accurately across all statuses", async () => {
		wireDefaultMocks();

		vi.mocked(compareFile)
			.mockResolvedValueOnce("differs")   // aide-spec.md
			.mockResolvedValueOnce("missing")   // aide-template.md
			.mockResolvedValueOnce("matches")   // versions.json
			.mockResolvedValueOnce("matches")   // aide command
			.mockResolvedValueOnce("matches");  // aide:research

		const result = await upgrade(tempDir);

		const docsCat = findCategory(result, "methodology-docs");
		expect(docsCat!.summary.total).toBe(2);
		expect(docsCat!.summary.differs).toBe(1);
		expect(docsCat!.summary.missing).toBe(1);
		expect(docsCat!.summary.matches).toBe(0);
	});

	// ── Test 10: Matches do not carry canonicalContent ───────────────────────
	it("omits canonicalContent for matching files", async () => {
		wireDefaultMocks();

		const result = await upgrade(tempDir);

		for (const cat of result.categories) {
			for (const file of cat.files) {
				if (file.status === "matches") {
					expect(file.canonicalContent).toBeUndefined();
				}
			}
		}
	});

	// ── Test 11 (5d): Brain matches when brain.aide is well-formed ───────────
	it("reports matches in brain category when brain.aide is well-formed", async () => {
		wireDefaultMocks();

		const result = await upgrade(tempDir);

		const brainCat = findCategory(result, "brain");
		expect(brainCat).toBeDefined();
		expect(brainCat!.files[0].status).toBe("matches");
		expect(brainCat!.summary.matches).toBe(1);
	});

	// ── Test 12 (5e): Brain missing when brain.aide is absent ────────────────
	it("reports missing in brain category when brain.aide is absent", async () => {
		wireDefaultMocks();
		vi.mocked(parseBrainAide).mockResolvedValue({ kind: "missing" });

		const result = await upgrade(tempDir);

		const brainCat = findCategory(result, "brain");
		expect(brainCat).toBeDefined();
		expect(brainCat!.files[0].status).toBe("missing");
		expect(brainCat!.summary.missing).toBe(1);
		expect(brainCat!.files[0].canonicalContent).toBeUndefined();
	});

	// ── Test 13 (5f): Brain malformed when frontmatter fails to parse ─────────
	it("reports malformed in brain category when frontmatter fails to parse", async () => {
		wireDefaultMocks();
		vi.mocked(parseBrainAide).mockResolvedValue({
			kind: "malformed-frontmatter",
			reason: "name is required and must be a non-empty string",
		});

		const result = await upgrade(tempDir);

		const brainCat = findCategory(result, "brain");
		expect(brainCat).toBeDefined();
		expect(brainCat!.files[0].status).toBe("malformed");
		expect(brainCat!.files[0].canonicalContent).toBeUndefined();
	});

	// ── Test 14 (5g): Brain malformed when body markers are malformed ─────────
	it("reports malformed in brain category when body markers are malformed", async () => {
		wireDefaultMocks();
		vi.mocked(parseBrainAide).mockResolvedValue({
			kind: "malformed-body",
			reason: "missing markers: <!-- aide-prose-start -->, <!-- aide-prose-end -->",
		});

		const result = await upgrade(tempDir);

		const brainCat = findCategory(result, "brain");
		expect(brainCat).toBeDefined();
		expect(brainCat!.files[0].status).toBe("malformed");
		expect(brainCat!.files[0].canonicalContent).toBeUndefined();
	});

	// ── Test 15 (5h): Brain category never sets prescription or canonicalContent
	it("brain category never sets prescription or canonicalContent", async () => {
		wireDefaultMocks();

		const result = await upgrade(tempDir);

		const brainCat = findCategory(result, "brain");
		expect(brainCat).toBeDefined();
		expect(brainCat!.files[0].prescription).toBeUndefined();
		expect(brainCat!.files[0].canonicalContent).toBeUndefined();
	});
});

describe("upgrade — response shaping (server-handler logic)", () => {
	/** Simulate the server handler's summary stripping. */
	function stripCanonicalContent(result: UpgradeResult): UpgradeResult {
		return {
			...result,
			categories: result.categories.map((cat) => ({
				...cat,
				files: cat.files.map(({ canonicalContent: _content, ...rest }) => rest),
			})),
		};
	}

	/** Simulate the server handler's category filtering. */
	function filterCategory(result: UpgradeResult, category: string): UpgradeResult {
		return {
			...result,
			categories: result.categories.filter((c) => c.category === category),
		};
	}

	it("summary mode: no files carry canonicalContent field", async () => {
		wireDefaultMocks();
		// Force at least one differs so canonicalContent would exist
		vi.mocked(compareFile)
			.mockResolvedValueOnce("differs")
			.mockResolvedValueOnce("differs")
			.mockResolvedValueOnce("differs")
			.mockResolvedValueOnce("differs")
			.mockResolvedValueOnce("differs");

		const result = await upgrade(tempDir);
		const stripped = stripCanonicalContent(result);

		for (const cat of stripped.categories) {
			for (const file of cat.files) {
				expect(file).not.toHaveProperty("canonicalContent");
			}
		}
	});

	it("summary mode: preserves metadata and summary counts", async () => {
		wireDefaultMocks();
		const result = await upgrade(tempDir);
		const stripped = stripCanonicalContent(result);

		expect(stripped.categories.length).toBe(result.categories.length);
		for (let i = 0; i < stripped.categories.length; i++) {
			expect(stripped.categories[i].category).toBe(result.categories[i].category);
			expect(stripped.categories[i].summary).toEqual(result.categories[i].summary);
			expect(stripped.categories[i].files.length).toBe(result.categories[i].files.length);
		}
	});

	it("category filter: returns only the specified category", async () => {
		wireDefaultMocks();
		const result = await upgrade(tempDir);
		const filtered = filterCategory(result, "commands");

		expect(filtered.categories.length).toBe(1);
		expect(filtered.categories[0].category).toBe("commands");
	});

	it("category filter: retains canonicalContent on differing files", async () => {
		wireDefaultMocks();
		vi.mocked(compareFile)
			.mockResolvedValueOnce("differs")   // aide-spec.md
			.mockResolvedValueOnce("differs")   // aide-template.md
			.mockResolvedValueOnce("matches")   // versions.json
			.mockResolvedValueOnce("differs")   // aide command
			.mockResolvedValueOnce("differs");  // aide:research

		const result = await upgrade(tempDir);
		const filtered = filterCategory(result, "commands");

		const differing = filtered.categories[0].files.filter((f) => f.status === "differs");
		expect(differing.length).toBeGreaterThan(0);
		for (const file of differing) {
			expect(file.canonicalContent).toBeDefined();
		}
	});
});

// ── Apply mode handler simulation ─────────────────────────────────────────────
// Tests that simulate the server handler's apply-mode branch: filter to a
// category, call applyFiles, recompute summary, strip canonicalContent.

vi.mock("./applyFiles/index.js");
import applyFiles from "./applyFiles/index.js";

describe("upgrade — apply mode (handler simulation)", () => {
	/** Simulate the handler's apply-mode path for a single category. */
	async function simulateApplyMode(
		result: UpgradeResult,
		category: string,
	): Promise<UpgradeCategoryResult[]> {
		const filtered = result.categories.filter((c) => c.category === category);
		return Promise.all(
			filtered.map(async (cat) => {
				const appliedFiles = await applyFiles(cat.files);
				const summary = {
					total: appliedFiles.length,
					differs: appliedFiles.filter((f) => f.status === "differs").length,
					missing: appliedFiles.filter((f) => f.status === "missing").length,
					matches: appliedFiles.filter((f) => f.status === "matches").length,
					updated: appliedFiles.filter((f) => f.status === "updated").length,
					created: appliedFiles.filter((f) => f.status === "created").length,
					unchanged: appliedFiles.filter((f) => f.status === "unchanged").length,
				};
				const manifestFiles = appliedFiles.map(({ canonicalContent: _content, ...rest }) => rest);
				return { ...cat, files: manifestFiles, summary };
			}),
		);
	}

	it("apply mode: returns updated/created statuses after applying differs/missing files", async () => {
		wireDefaultMocks();
		vi.mocked(compareFile)
			.mockResolvedValueOnce("differs")   // aide-spec.md
			.mockResolvedValueOnce("missing")   // aide-template.md
			.mockResolvedValueOnce("matches")   // versions.json
			.mockResolvedValueOnce("matches")   // aide command
			.mockResolvedValueOnce("matches");  // aide:research

		// applyFiles maps differs→updated, missing→created
		vi.mocked(applyFiles).mockImplementation(async (files) =>
			files.map((f) => {
				if (f.status === "differs") return { ...f, status: "updated" as const, canonicalContent: undefined };
				if (f.status === "missing") return { ...f, status: "created" as const, canonicalContent: undefined };
				return f;
			}),
		);

		const result = await upgrade(tempDir);
		const applied = await simulateApplyMode(result, "methodology-docs");

		expect(applied).toHaveLength(1);
		const cat = applied[0];
		expect(cat.summary.updated).toBe(1);
		expect(cat.summary.created).toBe(1);
		expect(cat.summary.differs).toBe(0);
		expect(cat.summary.missing).toBe(0);
	});

	it("apply mode: no canonicalContent in manifest files", async () => {
		wireDefaultMocks();
		vi.mocked(compareFile)
			.mockResolvedValueOnce("differs")
			.mockResolvedValueOnce("differs")
			.mockResolvedValueOnce("matches")
			.mockResolvedValueOnce("matches")
			.mockResolvedValueOnce("matches");

		vi.mocked(applyFiles).mockImplementation(async (files) =>
			files.map((f) => ({
				...f,
				status: f.status === "differs" ? ("updated" as const) : f.status,
				canonicalContent: undefined,
			})),
		);

		const result = await upgrade(tempDir);
		const applied = await simulateApplyMode(result, "methodology-docs");

		for (const file of applied[0].files) {
			expect(file).not.toHaveProperty("canonicalContent");
		}
	});

	it("apply mode: summary total matches file count", async () => {
		wireDefaultMocks();
		vi.mocked(compareFile).mockResolvedValue("differs");

		vi.mocked(applyFiles).mockImplementation(async (files) =>
			files.map((f) => ({ ...f, status: "updated" as const, canonicalContent: undefined })),
		);

		const result = await upgrade(tempDir);
		const applied = await simulateApplyMode(result, "methodology-docs");

		const cat = applied[0];
		expect(cat.summary.total).toBe(cat.files.length);
		expect(cat.summary.updated).toBe(cat.files.length);
	});

	it("apply mode: only returns the requested category", async () => {
		wireDefaultMocks();
		vi.mocked(applyFiles).mockImplementation(async (files) => files);

		const result = await upgrade(tempDir);
		const applied = await simulateApplyMode(result, "commands");

		expect(applied).toHaveLength(1);
		expect(applied[0].category).toBe("commands");
	});

	// ── Test 6a: Brain missing → instructions, no write ──────────────────────
	it("apply mode brain: missing → instructions, no write", async () => {
		wireDefaultMocks();
		vi.mocked(parseBrainAide).mockResolvedValue({ kind: "missing" });

		// applyFiles adds instructions and leaves status as "missing"
		vi.mocked(applyFiles).mockImplementation(async (files) =>
			files.map((f) => {
				if (f.category === "brain" && f.status === "missing") {
					return { ...f, instructions: "Run /aide:brain config to set up the brain.", canonicalContent: undefined };
				}
				return f;
			}),
		);

		const result = await upgrade(tempDir);
		const applied = await simulateApplyMode(result, "brain");

		expect(applied).toHaveLength(1);
		const file = applied[0].files[0];
		expect(file.instructions).toBe("Run /aide:brain config to set up the brain.");
		expect(file.status).toBe("missing");
		expect(file).not.toHaveProperty("canonicalContent");
	});

	// ── Test 6b: Brain malformed → instructions, no write ────────────────────
	it("apply mode brain: malformed → instructions, no write", async () => {
		wireDefaultMocks();
		vi.mocked(parseBrainAide).mockResolvedValue({
			kind: "malformed-frontmatter",
			reason: "name is required and must be a non-empty string",
		});

		// applyFiles adds instructions and leaves status as "malformed"
		vi.mocked(applyFiles).mockImplementation(async (files) =>
			files.map((f) => {
				if (f.category === "brain" && f.status === "malformed") {
					return { ...f, instructions: "Run /aide:brain config to set up the brain.", canonicalContent: undefined };
				}
				return f;
			}),
		);

		const result = await upgrade(tempDir);
		const applied = await simulateApplyMode(result, "brain");

		expect(applied).toHaveLength(1);
		const file = applied[0].files[0];
		expect(file.instructions).toBe("Run /aide:brain config to set up the brain.");
		expect(file.status).toBe("malformed");
		expect(file).not.toHaveProperty("canonicalContent");
	});

	// ── Test 6c: Brain matches → unchanged, no instructions ──────────────────
	it("apply mode brain: matches → unchanged, no instructions", async () => {
		wireDefaultMocks();
		// Default parseBrainAide mock already returns { kind: "ok" } → status "matches"

		// applyFiles maps matches → "unchanged" (the standard matches branch)
		vi.mocked(applyFiles).mockImplementation(async (files) =>
			files.map((f) => {
				if (f.category === "brain" && f.status === "matches") {
					return { ...f, status: "unchanged" as const, canonicalContent: undefined };
				}
				return f;
			}),
		);

		const result = await upgrade(tempDir);
		const applied = await simulateApplyMode(result, "brain");

		expect(applied).toHaveLength(1);
		const file = applied[0].files[0];
		expect(file.status).toBe("unchanged");
		expect(file.instructions).toBeUndefined();
		expect(file).not.toHaveProperty("canonicalContent");
	});
});
