import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { FrameworkConfig, UpgradeResult } from "@/types/index.js";

// ── Module mocks ─────────────────────────────────────────────────────────────

vi.mock("@/tools/init/detectFramework/index.js");
vi.mock("@/tools/init/initContent/index.js");
vi.mock("@/tools/init/scaffoldCommands/index.js", () => ({
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

import detectFramework from "@/tools/init/detectFramework/index.js";
import { readCanonicalDoc, listMethodologyDocs, listAgents, listSkills } from "@/tools/init/initContent/index.js";
import compareFile from "./compareFile/index.js";
import spliceStub from "./spliceStub/index.js";
import buildVersionsMeta from "./buildVersionsMeta/index.js";
import checkMcpConfig from "./checkMcpConfig/index.js";
import { checkZedConfig, checkVscodeExtension } from "./checkIdeConfig/index.js";
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
	vi.mocked(buildVersionsMeta).mockResolvedValue({
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
		expect(result.categories).toHaveLength(8);

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
		const prescription = { key: "aide", entry: { command: "npx", args: ["aidemd-mcp"] } };
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

		// ide should have 2 entries (zed + vscode)
		const ideCat = findCategory(result, "ide");
		expect(ideCat!.files).toHaveLength(2);
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
});
