import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { FrameworkConfig } from "@/types/index.js";

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

// execFile is used by checkVscodeExtension — mock it to avoid spawning `code`.
vi.mock("node:child_process", () => ({
	execFile: vi.fn((_cmd: string, _args: string[], cb: (err: Error | null, result?: { stdout: string }) => void) => {
		cb(new Error("code not found"));
	}),
}));

import detectFramework from "@/tools/init/detectFramework/index.js";
import { readCanonicalDoc, listMethodologyDocs } from "@/tools/init/initContent/index.js";
import compareFile from "./compareFile/index.js";
import spliceStub from "./spliceStub/index.js";
import upgrade from "./index.js";

// ── Helpers ───────────────────────────────────────────────────────────────────

const CLAUDE_CONFIG: FrameworkConfig = {
	framework: "claude",
	configPath: "CLAUDE.md",
	commandDir: ".claude/commands",
	mcpConfigPath: ".mcp.json",
	docHubDir: ".aide/docs",
};

const CURSOR_CONFIG: FrameworkConfig = {
	framework: "cursor",
	configPath: ".cursorrules",
	commandDir: ".cursor/commands",
	mcpConfigPath: ".cursor/mcp.json",
	docHubDir: ".aide/docs",
};

/** Minimal two-entry methodology doc list returned by the mock. */
const MOCK_METHODOLOGY_DOCS = [
	{ canonical: "aide-spec" as const, hostFilename: "aide-spec.md" },
	{ canonical: "aide-template" as const, hostFilename: "aide-template.md" },
];

// ── Test fixtures ─────────────────────────────────────────────────────────────

let tempDir: string;

beforeEach(async () => {
	tempDir = await mkdtemp(join(tmpdir(), "aide-upgrade-"));
	vi.resetAllMocks();

	// Default mock for execFile: `code` CLI not available → VS Code check returns unchanged.
	const { execFile } = await import("node:child_process");
	(execFile as unknown as ReturnType<typeof vi.fn>).mockImplementation(
		(_cmd: string, _args: string[], cb: (err: Error | null) => void) => {
			cb(new Error("code not found"));
		},
	);
});

afterEach(async () => {
	await rm(tempDir, { recursive: true, force: true });
});

// ── Shared mock wiring ─────────────────────────────────────────────────────────

function wireDefaultMocks(config: FrameworkConfig = CLAUDE_CONFIG) {
	vi.mocked(detectFramework).mockResolvedValue(config);
	vi.mocked(listMethodologyDocs).mockReturnValue(MOCK_METHODOLOGY_DOCS);
	vi.mocked(readCanonicalDoc).mockReturnValue("canonical content");
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("upgrade", () => {
	// ── Test 1: All unchanged → short-circuit message ───────────────────────
	it("returns all-current message when every artifact is unchanged", async () => {
		wireDefaultMocks();

		// stub returns unchanged
		vi.mocked(spliceStub).mockResolvedValue({ name: "Methodology pointer", status: "unchanged" });
		// all docs and commands unchanged
		vi.mocked(compareFile).mockResolvedValue("unchanged");

		// No .mcp.json exists → would create, but we need unchanged for this test.
		// Provide a real .mcp.json with canonical content so checkMcpConfig reports unchanged.
		const { writeFile } = await import("node:fs/promises");
		const mcpPath = join(tempDir, ".mcp.json");
		await writeFile(
			mcpPath,
			JSON.stringify({ mcpServers: { aide: { command: "npx", args: ["aidemd-mcp"] } } }, null, 2) + "\n",
			"utf-8",
		);

		const result = await upgrade(tempDir, false, undefined, undefined, true);

		// Header is present
		expect(result).toContain("AIDE upgrade preview (claude framework):");

		// All-current short-circuit line
		expect(result).toContain("All");
		expect(result).toContain("methodology artifacts match canonical. Nothing to upgrade.");

		// No warning block
		expect(result).not.toContain("Warning");

		// spliceStub and compareFile were called
		expect(vi.mocked(spliceStub)).toHaveBeenCalled();
		expect(vi.mocked(compareFile)).toHaveBeenCalled();
	});

	// ── Test 2: Mixed statuses dry-run → preview with correct symbols ────────
	it("returns dry-run preview with correct prefix symbols and composed warning", async () => {
		wireDefaultMocks();

		// stub has drifted
		vi.mocked(spliceStub).mockResolvedValue({ name: "Methodology pointer", status: "would update" });

		// first doc drifted, second unchanged, commands both unchanged
		vi.mocked(compareFile)
			.mockResolvedValueOnce("would update")  // aide-spec.md
			.mockResolvedValueOnce("unchanged")      // aide-template.md
			.mockResolvedValueOnce("would update")   // aide command (aide.md)
			.mockResolvedValueOnce("unchanged");     // aide:research

		// MCP config: canonical — write a real file so checkMcpConfig is happy.
		const { writeFile } = await import("node:fs/promises");
		await writeFile(
			join(tempDir, ".mcp.json"),
			JSON.stringify({ mcpServers: { aide: { command: "npx", args: ["aidemd-mcp"] } } }, null, 2) + "\n",
			"utf-8",
		);

		const result = await upgrade(tempDir, false, undefined, undefined, true);

		// Header
		expect(result).toContain("AIDE upgrade preview (claude framework):");

		// Prefix symbols
		expect(result).toContain("  ~ Methodology pointer: would update");
		expect(result).toContain("  ~ .aide/docs/aide-spec.md: would update");
		expect(result).toContain("  = .aide/docs/aide-template.md: unchanged");
		expect(result).toContain("  ~ aide: would update");
		expect(result).toContain("  = aide:research: unchanged");

		// Warning block present
		expect(result).toContain("Warning: confirming will overwrite local customizations in:");

		// Warning names only the affected categories
		expect(result).toContain("pointer stub");
		expect(result).toContain("methodology docs");
		expect(result).toContain("slash commands");

		// The warning names only affected categories — "MCP config" must not
		// appear inside the warning text (it is fine if it appears in the file list).
		const warningSection = result.slice(result.indexOf("Warning:"));
		expect(warningSection).not.toContain("MCP config");

		// Confirm prompt
		expect(result).toContain("confirm: true");
	});

	// ── Test 3: confirm=true → final statuses with header and counts ─────────
	it("returns final statuses with AIDE upgraded header and summary counts line", async () => {
		wireDefaultMocks();

		// 1 stub created, 1 doc updated, 1 doc unchanged, 1 cmd created, 1 cmd unchanged
		vi.mocked(spliceStub).mockResolvedValue({ name: "Methodology pointer", status: "created" });

		vi.mocked(compareFile)
			.mockResolvedValueOnce("updated")     // aide-spec.md
			.mockResolvedValueOnce("unchanged")   // aide-template.md
			.mockResolvedValueOnce("created")     // aide.md (command)
			.mockResolvedValueOnce("unchanged");  // aide:research

		// MCP config: canonical file present
		const { writeFile } = await import("node:fs/promises");
		await writeFile(
			join(tempDir, ".mcp.json"),
			JSON.stringify({ mcpServers: { aide: { command: "npx", args: ["aidemd-mcp"] } } }, null, 2) + "\n",
			"utf-8",
		);

		const result = await upgrade(tempDir, true, undefined, undefined, true);

		// Confirmed header
		expect(result).toContain("AIDE upgraded (claude framework):");

		// Final status symbols
		expect(result).toContain("  + Methodology pointer: created");
		expect(result).toContain("  ~ .aide/docs/aide-spec.md: updated");
		expect(result).toContain("  = .aide/docs/aide-template.md: unchanged");
		expect(result).toContain("  + aide: created");
		expect(result).toContain("  = aide:research: unchanged");

		// Summary counts: 2 created (stub + aide command), 1 updated (aide-spec),
		// at least 2 unchanged (aide-template + aide:research + MCP config)
		expect(result).toContain("2 files created");
		expect(result).toContain("1 file updated");
		expect(result).toMatch(/\d+ files? unchanged/);

		// No dry-run warning
		expect(result).not.toContain("Warning");
	});

	// ── Test 4: Framework override forwarded to detectFramework ─────────────
	it("forwards framework override to detectFramework", async () => {
		wireDefaultMocks(CURSOR_CONFIG);
		vi.mocked(detectFramework).mockResolvedValue(CURSOR_CONFIG);

		vi.mocked(spliceStub).mockResolvedValue({ name: "Methodology pointer", status: "unchanged" });
		vi.mocked(compareFile).mockResolvedValue("unchanged");

		const { writeFile, mkdir } = await import("node:fs/promises");
		await mkdir(join(tempDir, ".cursor"), { recursive: true });
		await writeFile(
			join(tempDir, ".cursor", "mcp.json"),
			JSON.stringify({ mcpServers: { aide: { command: "npx", args: ["aidemd-mcp"] } } }, null, 2) + "\n",
			"utf-8",
		);

		await upgrade(tempDir, false, "cursor", undefined, true);

		// detectFramework was called with the framework override
		expect(vi.mocked(detectFramework)).toHaveBeenCalledWith(
			expect.any(String),
			"cursor",
		);
	});

	// ── Test 5: skipIde=true → IDE results absent from output ───────────────
	it("omits IDE results when skipIde is true", async () => {
		wireDefaultMocks();

		vi.mocked(spliceStub).mockResolvedValue({ name: "Methodology pointer", status: "unchanged" });
		vi.mocked(compareFile).mockResolvedValue("unchanged");

		const { writeFile } = await import("node:fs/promises");
		await writeFile(
			join(tempDir, ".mcp.json"),
			JSON.stringify({ mcpServers: { aide: { command: "npx", args: ["aidemd-mcp"] } } }, null, 2) + "\n",
			"utf-8",
		);

		const resultWithSkip = await upgrade(tempDir, false, undefined, undefined, true);

		// IDE names must not appear in the output at all
		expect(resultWithSkip).not.toContain("Zed config");
		expect(resultWithSkip).not.toContain("VS Code extension");
	});

	it("includes IDE results when skipIde is false or omitted", async () => {
		wireDefaultMocks();

		vi.mocked(spliceStub).mockResolvedValue({ name: "Methodology pointer", status: "unchanged" });
		vi.mocked(compareFile).mockResolvedValue("unchanged");

		const { writeFile } = await import("node:fs/promises");
		await writeFile(
			join(tempDir, ".mcp.json"),
			JSON.stringify({ mcpServers: { aide: { command: "npx", args: ["aidemd-mcp"] } } }, null, 2) + "\n",
			"utf-8",
		);

		// When code CLI is unavailable, Zed config is still checked (returns would create
		// for missing settings file). This confirms the IDE branch ran.
		const result = await upgrade(tempDir, false, undefined, undefined, false);

		// At least one of the IDE names must appear
		const hasIde = result.includes("Zed config") || result.includes("VS Code extension");
		expect(hasIde).toBe(true);
	});
});
