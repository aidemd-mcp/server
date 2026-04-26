import { describe, it, expect, vi, beforeEach } from "vitest";
import path from "node:path";

// Intercept process.exit before the module loads so the IIFE's process.exit
// calls are no-ops. vi.hoisted runs before vi.mock hoisting and before any
// module imports resolve, ensuring the spy is in place when the IIFE executes.
const { mockExit } = vi.hoisted(() => {
	const mockExit = vi.fn();
	process.exit = mockExit as unknown as typeof process.exit;
	return { mockExit };
});

// ─── Mock targets ───────────────────────────────────────────────────────────
// Every module the orchestrator imports that the test wants to control.
// The six CLI-local duplicate writers (writeMethodologyStub, writeMethodologyHub,
// writeCommands, writeAgents, writeSkills, writeAideTree, writeInitCommand) were
// deleted in Step 1 — no mocks for them here by design.
// ────────────────────────────────────────────────────────────────────────────
vi.mock("node:fs/promises", () => ({
	writeFile: vi.fn().mockResolvedValue(undefined),
	access: vi.fn().mockResolvedValue(undefined),
	mkdir: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/service/install/provisionBrain/obsidianBrainAideTemplate/index.js", () => ({
	default: vi.fn().mockReturnValue("# canonical brain.aide content"),
}));
vi.mock("./writeMcpEntry/index.js", () => ({
	default: vi.fn(),
}));
vi.mock("./renderWarning/index.js", () => ({
	default: vi.fn(),
}));
vi.mock("@/service/install/detectFramework/index.js", () => ({
	default: vi.fn(),
}));
vi.mock("@/service/install/writeMethodology/index.js", () => ({
	default: vi.fn(),
}));
vi.mock("@/service/install/installMethodologyDocs/index.js", () => ({
	default: vi.fn(),
}));
vi.mock("@/service/install/scaffoldCommands/index.js", () => ({
	default: vi.fn(),
}));
vi.mock("@/service/install/installAgents/index.js", () => ({
	default: vi.fn(),
}));
vi.mock("@/service/install/installSkills/index.js", () => ({
	default: vi.fn(),
}));
vi.mock("@/service/install/installAideTree/index.js", () => ({
	default: vi.fn(),
}));
vi.mock("@/service/install/scaffoldReadme/index.js", () => ({
	default: vi.fn(),
}));
vi.mock("@/service/install/applySteps/index.js", () => ({
	default: vi.fn(),
}));
vi.mock("@/tools/upgrade/buildVersionsMeta/index.js", () => ({
	default: vi.fn(),
}));
vi.mock("@/service/install/shared/compareBytes/index.js", () => ({
	default: vi.fn(),
}));

import { runInit } from "./index.js";
import { writeFile, access } from "node:fs/promises";
import obsidianBrainAideTemplate from "@/service/install/provisionBrain/obsidianBrainAideTemplate/index.js";
import writeMcpEntry from "./writeMcpEntry/index.js";
import renderWarning from "./renderWarning/index.js";
import detectFramework from "@/service/install/detectFramework/index.js";
import writeMethodology from "@/service/install/writeMethodology/index.js";
import installMethodologyDocs from "@/service/install/installMethodologyDocs/index.js";
import scaffoldCommands from "@/service/install/scaffoldCommands/index.js";
import installAgents from "@/service/install/installAgents/index.js";
import installSkills from "@/service/install/installSkills/index.js";
import installAideTree from "@/service/install/installAideTree/index.js";
import scaffoldReadme from "@/service/install/scaffoldReadme/index.js";
import applySteps from "@/service/install/applySteps/index.js";
import readVersionsManifest from "@/tools/upgrade/buildVersionsMeta/index.js";
import compareBytes from "@/service/install/shared/compareBytes/index.js";
import type { InitStep } from "@/types/index.js";

const mockWriteFile = vi.mocked(writeFile);
const mockAccess = vi.mocked(access);
const mockObsidianBrainAideTemplate = vi.mocked(obsidianBrainAideTemplate);
const mockWriteMcpEntry = vi.mocked(writeMcpEntry);
const mockRenderWarning = vi.mocked(renderWarning);
const mockDetectFramework = vi.mocked(detectFramework);
const mockWriteMethodology = vi.mocked(writeMethodology);
const mockInstallMethodologyDocs = vi.mocked(installMethodologyDocs);
const mockScaffoldCommands = vi.mocked(scaffoldCommands);
const mockInstallAgents = vi.mocked(installAgents);
const mockInstallSkills = vi.mocked(installSkills);
const mockInstallAideTree = vi.mocked(installAideTree);
const mockScaffoldReadme = vi.mocked(scaffoldReadme);
const mockApplySteps = vi.mocked(applySteps);
const mockReadVersionsManifest = vi.mocked(readVersionsManifest);
const mockCompareBytes = vi.mocked(compareBytes);

// Canonical two deferred categories when vaultPath is absent.
const DEFERRED_CATEGORIES = [
	"Brain wiring (.aide/config/brain.aide + derived brain MCP entry) — open Claude Code and run /aide; the orchestrator will prompt for the vault path, scaffold .aide/config/brain.aide, and tell you to run npx aidemd-mcp sync",
	"IDE configuration — re-run: npx aidemd-mcp init --ide <choice>",
];

// Single deferred category when vaultPath IS supplied.
const DEFERRED_CATEGORIES_WITH_VAULT = [
	"IDE configuration — re-run: npx aidemd-mcp init --ide <choice>",
];

// Framework config returned by detectFramework when called with "claude".
const CLAUDE_CONFIG = {
	framework: "claude" as const,
	configPath: "CLAUDE.md",
	commandDir: ".claude/commands",
	mcpConfigPath: ".mcp.json",
	docHubDir: ".aide/docs",
	agentDir: ".claude/agents",
	skillDir: ".claude/skills",
};

const CWD = "/fake/cwd";

/** Build an InitStep with sensible defaults — override per test. */
function makeStep(
	overrides: Partial<InitStep> & { filePath: string; name: string },
): InitStep {
	return {
		status: "would-create",
		category: "methodology",
		content: "canonical content",
		...overrides,
	};
}

/**
 * Flip a step's status from would-create to created (simulating applySteps).
 * applySteps strips content when writing; here we keep the shape simple.
 */
function applyStep(step: InitStep): InitStep {
	return { ...step, status: "created", content: undefined };
}

beforeEach(() => {
	vi.clearAllMocks();

	// Default mock return values — per-test overrides build on these.
	// access resolves by default (file exists), so brain.aide scaffold skips for
	// most tests. Tests that need to exercise the scaffold override this.
	mockAccess.mockResolvedValue(undefined);
	mockWriteFile.mockResolvedValue(undefined);
	mockObsidianBrainAideTemplate.mockReturnValue("# canonical brain.aide content");
	mockWriteMcpEntry.mockResolvedValue({ status: "created", message: "aide server entry" });
	mockDetectFramework.mockResolvedValue(CLAUDE_CONFIG);
	mockWriteMethodology.mockResolvedValue(
		makeStep({ filePath: `${CWD}/CLAUDE.md`, name: "Methodology pointer" }),
	);
	mockInstallMethodologyDocs.mockResolvedValue([]);
	mockScaffoldCommands.mockResolvedValue([]);
	mockInstallAgents.mockResolvedValue([]);
	mockInstallSkills.mockResolvedValue([]);
	mockInstallAideTree.mockResolvedValue([]);
	mockScaffoldReadme.mockResolvedValue(
		makeStep({ filePath: `${CWD}/README.md`, name: "README.md", category: "readme" }),
	);
	mockReadVersionsManifest.mockReturnValue({});
	mockCompareBytes.mockResolvedValue("would-create");
	// applySteps flips would-create → created on the input array.
	mockApplySteps.mockImplementation(async (steps) => steps.map(applyStep));
	mockRenderWarning.mockReturnValue("WARNING BLOCK");
});

// ---------------------------------------------------------------------------
// Cold-start happy path — everything created
// ---------------------------------------------------------------------------
describe("cold-start happy path — every step is would-create", () => {
	const methodologyStep = makeStep({ filePath: `${CWD}/CLAUDE.md`, name: "Methodology pointer" });
	const docStep = makeStep({ filePath: `${CWD}/.aide/docs/index.md`, name: "index.md", category: "methodology" });
	const commandStep = makeStep({ filePath: `${CWD}/.claude/commands/aide/research.md`, name: "aide:research", category: "commands" });
	const agentStep = makeStep({ filePath: `${CWD}/.claude/agents/aide/aide-architect.md`, name: "aide-architect.md", category: "agents" });
	const skillStep = makeStep({ filePath: `${CWD}/.claude/skills/study-playbook/SKILL.md`, name: "study-playbook/SKILL.md", category: "skills" });
	const aideTreeStep = makeStep({ filePath: `${CWD}/.aide/bin/aide-tree.mjs`, name: "aide-tree.mjs", category: "methodology" });
	const readmeStep = makeStep({ filePath: `${CWD}/README.md`, name: "README.md", category: "readme" });

	beforeEach(() => {
		mockWriteMethodology.mockResolvedValue(methodologyStep);
		mockInstallMethodologyDocs.mockResolvedValue([docStep]);
		mockScaffoldCommands.mockResolvedValue([commandStep]);
		mockInstallAgents.mockResolvedValue([agentStep]);
		mockInstallSkills.mockResolvedValue([skillStep]);
		mockInstallAideTree.mockResolvedValue([aideTreeStep]);
		mockScaffoldReadme.mockResolvedValue(readmeStep);
		mockCompareBytes.mockResolvedValue("would-create");
	});

	it("per-file log shows [created] for every artifact", async () => {
		const lines: string[] = [];
		await runInit(CWD, (l) => lines.push(l));

		// MCP entry is always first
		expect(lines[0]).toBe("[created] .mcp.json — aide server entry");
		// All planning-step results show [created]
		const createdLines = lines.filter((l) => l.startsWith("[created]"));
		expect(createdLines.length).toBeGreaterThan(0);
		// No skipped or failed lines on the happy path
		expect(lines.some((l) => l.startsWith("[skipped"))).toBe(false);
		expect(lines.some((l) => l.startsWith("[failed]"))).toBe(false);
	});

	it("applySteps receives the full would-create set (including all categories)", async () => {
		await runInit(CWD, () => {});

		const [calledWith] = mockApplySteps.mock.calls[0];
		// All planning steps are would-create, so all should reach applySteps
		expect(calledWith.length).toBeGreaterThanOrEqual(5);
		expect(calledWith.every((s: InitStep) => s.status === "would-create")).toBe(true);
	});

	it("renderWarning receives skipped:[], failed:[], and the two deferred categories", async () => {
		await runInit(CWD, () => {});

		expect(mockRenderWarning).toHaveBeenCalledWith({
			skipped: [],
			failed: [],
			deferredCategories: DEFERRED_CATEGORIES,
		});
	});

	it("the returned warning block string is written line by line", async () => {
		mockRenderWarning.mockReturnValue("line1\nline2\nline3");
		const lines: string[] = [];
		await runInit(CWD, (l) => lines.push(l));

		expect(lines).toContain("line1");
		expect(lines).toContain("line2");
		expect(lines).toContain("line3");
	});

	it("returns exit code 0", async () => {
		const code = await runInit(CWD, () => {});
		expect(code).toBe(0);
	});
});

// ---------------------------------------------------------------------------
// Idempotent re-run — all artifacts exist
// ---------------------------------------------------------------------------
describe("idempotent re-run — every step is exists", () => {
	const existsStep = (filePath: string, name: string, category: InitStep["category"] = "methodology"): InitStep =>
		({ status: "exists", category, filePath, name });

	beforeEach(() => {
		mockWriteMcpEntry.mockResolvedValue({ status: "exists", message: "aide server already configured" });
		mockWriteMethodology.mockResolvedValue(existsStep(`${CWD}/CLAUDE.md`, "Methodology pointer"));
		mockInstallMethodologyDocs.mockResolvedValue([
			existsStep(`${CWD}/.aide/docs/index.md`, "index.md"),
		]);
		mockScaffoldCommands.mockResolvedValue([
			existsStep(`${CWD}/.claude/commands/aide/research.md`, "aide:research", "commands"),
		]);
		mockInstallAgents.mockResolvedValue([
			existsStep(`${CWD}/.claude/agents/aide/aide-architect.md`, "aide-architect.md", "agents"),
		]);
		mockInstallSkills.mockResolvedValue([
			existsStep(`${CWD}/.claude/skills/study-playbook/SKILL.md`, "study-playbook/SKILL.md", "skills"),
		]);
		mockInstallAideTree.mockResolvedValue([
			existsStep(`${CWD}/.aide/bin/aide-tree.mjs`, "aide-tree.mjs"),
		]);
		mockScaffoldReadme.mockResolvedValue(existsStep(`${CWD}/README.md`, "README.md", "readme"));
		mockCompareBytes.mockResolvedValue("would-skip"); // versions.json bytes match → exists
	});

	it("applySteps is called with an empty array (no would-create steps)", async () => {
		await runInit(CWD, () => {});

		const [calledWith] = mockApplySteps.mock.calls[0];
		expect(calledWith).toHaveLength(0);
	});

	it("per-file log shows [exists] for every artifact", async () => {
		const lines: string[] = [];
		await runInit(CWD, (l) => lines.push(l));

		expect(lines.some((l) => l.startsWith("[exists]"))).toBe(true);
		expect(lines.some((l) => l.startsWith("[created]"))).toBe(false);
		expect(lines.some((l) => l.startsWith("[skipped"))).toBe(false);
	});

	it("renderWarning is still called with skipped:[], failed:[], and the two deferred categories", async () => {
		await runInit(CWD, () => {});

		expect(mockRenderWarning).toHaveBeenCalledWith({
			skipped: [],
			failed: [],
			deferredCategories: DEFERRED_CATEGORIES,
		});
	});

	it("when renderWarning returns a non-empty string, that block is written", async () => {
		mockRenderWarning.mockReturnValue("DEFERRED BLOCK");
		const lines: string[] = [];
		await runInit(CWD, (l) => lines.push(l));

		expect(lines).toContain("DEFERRED BLOCK");
	});

	it("when renderWarning returns empty string, the completion line is written instead", async () => {
		mockRenderWarning.mockReturnValue("");
		const lines: string[] = [];
		await runInit(CWD, (l) => lines.push(l));

		expect(lines).toContain("Already set up.");
		expect(lines.some((l) => l.includes("WARNING"))).toBe(false);
	});

	it("returns exit code 0", async () => {
		const code = await runInit(CWD, () => {});
		expect(code).toBe(0);
	});
});

// ---------------------------------------------------------------------------
// Mixed — some created, some exists, some drifted (would-overwrite)
// ---------------------------------------------------------------------------
describe("mixed run — would-create, exists, and would-overwrite steps", () => {
	const wouldCreate = makeStep({ filePath: `${CWD}/.aide/docs/index.md`, name: "index.md" });
	const exists = { status: "exists" as const, category: "methodology" as const, filePath: `${CWD}/CLAUDE.md`, name: "Methodology pointer" };
	const wouldOverwrite = makeStep({
		filePath: `${CWD}/.claude/commands/aide/research.md`,
		name: "aide:research",
		category: "commands",
		status: "would-overwrite",
	});

	beforeEach(() => {
		mockWriteMethodology.mockResolvedValue(exists);
		mockInstallMethodologyDocs.mockResolvedValue([wouldCreate]);
		mockScaffoldCommands.mockResolvedValue([wouldOverwrite]);
		mockInstallAgents.mockResolvedValue([]);
		mockInstallSkills.mockResolvedValue([]);
		mockInstallAideTree.mockResolvedValue([]);
		mockScaffoldReadme.mockResolvedValue({
			status: "exists",
			category: "readme",
			filePath: `${CWD}/README.md`,
			name: "README.md",
		});
		mockCompareBytes.mockResolvedValue("would-create");
	});

	it("applySteps receives only the would-create subset (not exists or would-overwrite)", async () => {
		await runInit(CWD, () => {});

		const [calledWith] = mockApplySteps.mock.calls[0];
		expect(calledWith.every((s: InitStep) => s.status === "would-create")).toBe(true);
		// would-overwrite step must NOT be in the apply set
		const overwritePaths = calledWith.map((s: InitStep) => s.filePath);
		expect(overwritePaths).not.toContain(wouldOverwrite.filePath);
	});

	it("per-file log shows [created] for would-create, [exists] for exists, [skipped-drift] for would-overwrite", async () => {
		const lines: string[] = [];
		await runInit(CWD, (l) => lines.push(l));

		const createdDocLine = lines.find((l) => l.includes(".aide/docs/index.md"));
		expect(createdDocLine).toMatch(/^\[created\]/);

		const existsLine = lines.find((l) => l.includes("CLAUDE.md"));
		expect(existsLine).toMatch(/^\[exists\]/);

		const driftedLine = lines.find((l) => l.includes("aide:research") || l.includes("research.md"));
		expect(driftedLine).toMatch(/^\[skipped-drift\]/);
	});

	it("renderWarning receives the would-overwrite entry in skipped (not the exists entry)", async () => {
		await runInit(CWD, () => {});

		const call = mockRenderWarning.mock.calls[0][0];
		// The drifted command should be in skipped
		expect(
			call.skipped.some((r: { displayPath: string }) =>
				r.displayPath.includes("research.md"),
			),
		).toBe(true);
		// The exists entry must NOT be in skipped
		expect(
			call.skipped.some((r: { displayPath: string }) => r.displayPath === "CLAUDE.md"),
		).toBe(false);
	});

	it("returns exit code 0", async () => {
		const code = await runInit(CWD, () => {});
		expect(code).toBe(0);
	});
});

// ---------------------------------------------------------------------------
// Missing canonical content — would-skip from a planner
// ---------------------------------------------------------------------------
describe("missing canonical content — would-skip step from a planner", () => {
	const wouldSkipStep: InitStep = {
		status: "would-skip",
		category: "commands",
		filePath: `${CWD}/.claude/commands/aide/broken.md`,
		name: "aide:broken",
	};

	beforeEach(() => {
		mockScaffoldCommands.mockResolvedValue([wouldSkipStep]);
	});

	it("the would-skip step does NOT reach applySteps", async () => {
		await runInit(CWD, () => {});

		const [calledWith] = mockApplySteps.mock.calls[0];
		const paths = calledWith.map((s: InitStep) => s.filePath);
		expect(paths).not.toContain(wouldSkipStep.filePath);
	});

	it("per-file log shows [skipped-missing-canonical] for the step", async () => {
		const lines: string[] = [];
		await runInit(CWD, (l) => lines.push(l));

		const skippedLine = lines.find((l) => l.includes("broken.md"));
		expect(skippedLine).toMatch(/^\[skipped-missing-canonical\]/);
	});

	it("renderWarning receives the step in skipped", async () => {
		await runInit(CWD, () => {});

		const call = mockRenderWarning.mock.calls[0][0];
		expect(
			call.skipped.some((r: { displayPath: string }) => r.displayPath.includes("broken.md")),
		).toBe(true);
	});

	it("returns exit code 0", async () => {
		const code = await runInit(CWD, () => {});
		expect(code).toBe(0);
	});
});

// ---------------------------------------------------------------------------
// Abort path — writeMcpEntry throws (malformed .mcp.json)
// ---------------------------------------------------------------------------
describe("abort path — writeMcpEntry throws", () => {
	it("runInit rejects with the thrown error", async () => {
		mockWriteMcpEntry.mockRejectedValue(
			new Error(".mcp.json exists but contains invalid JSON. Fix the syntax error and re-run."),
		);

		await expect(runInit(CWD, () => {})).rejects.toThrow(
			".mcp.json exists but contains invalid JSON. Fix the syntax error and re-run.",
		);
	});

	it("no other helper is invoked after the throw", async () => {
		mockWriteMcpEntry.mockRejectedValue(new Error("malformed"));

		await expect(runInit(CWD, () => {})).rejects.toThrow();

		expect(mockDetectFramework).not.toHaveBeenCalled();
		expect(mockWriteMethodology).not.toHaveBeenCalled();
		expect(mockInstallMethodologyDocs).not.toHaveBeenCalled();
		expect(mockScaffoldCommands).not.toHaveBeenCalled();
		expect(mockInstallAgents).not.toHaveBeenCalled();
		expect(mockInstallSkills).not.toHaveBeenCalled();
		expect(mockInstallAideTree).not.toHaveBeenCalled();
		expect(mockScaffoldReadme).not.toHaveBeenCalled();
		expect(mockApplySteps).not.toHaveBeenCalled();
		expect(mockRenderWarning).not.toHaveBeenCalled();
	});
});

// ---------------------------------------------------------------------------
// Invocation ordering — writeMcpEntry runs before every other helper
// ---------------------------------------------------------------------------
describe("invocation ordering", () => {
	it("writeMcpEntry is called before detectFramework, all planners, applySteps, and renderWarning", async () => {
		const order: string[] = [];

		mockWriteMcpEntry.mockImplementation(async () => {
			order.push("writeMcpEntry");
			return { status: "created" as const, message: "aide server entry" };
		});
		mockDetectFramework.mockImplementation(async () => {
			order.push("detectFramework");
			return CLAUDE_CONFIG;
		});
		mockWriteMethodology.mockImplementation(async () => {
			order.push("writeMethodology");
			return makeStep({ filePath: `${CWD}/CLAUDE.md`, name: "Methodology pointer" });
		});
		mockInstallMethodologyDocs.mockImplementation(async () => {
			order.push("installMethodologyDocs");
			return [];
		});
		mockScaffoldCommands.mockImplementation(async () => {
			order.push("scaffoldCommands");
			return [];
		});
		mockInstallAgents.mockImplementation(async () => {
			order.push("installAgents");
			return [];
		});
		mockInstallSkills.mockImplementation(async () => {
			order.push("installSkills");
			return [];
		});
		mockInstallAideTree.mockImplementation(async () => {
			order.push("installAideTree");
			return [];
		});
		mockScaffoldReadme.mockImplementation(async () => {
			order.push("scaffoldReadme");
			return makeStep({ filePath: `${CWD}/README.md`, name: "README.md", category: "readme" });
		});
		mockApplySteps.mockImplementation(async (steps) => {
			order.push("applySteps");
			return steps.map(applyStep);
		});
		mockRenderWarning.mockImplementation(() => {
			order.push("renderWarning");
			return "WARNING BLOCK";
		});

		await runInit(CWD, () => {});

		const mcpIdx = order.indexOf("writeMcpEntry");
		// writeMcpEntry must run before all service planners, applySteps, and
		// renderWarning. (The brain.aide scaffold via fs.access may run before it
		// when vaultPath is supplied, but that is not tracked in this order array.)
		expect(mcpIdx).toBeGreaterThanOrEqual(0);

		for (const name of [
			"detectFramework",
			"writeMethodology",
			"installMethodologyDocs",
			"scaffoldCommands",
			"installAgents",
			"installSkills",
			"installAideTree",
			"scaffoldReadme",
			"applySteps",
			"renderWarning",
		]) {
			expect(mcpIdx, `${name} must run after writeMcpEntry`).toBeLessThan(
				order.indexOf(name),
			);
		}
	});
});

// ---------------------------------------------------------------------------
// Deferred categories — always passed to renderWarning in every non-abort test
// ---------------------------------------------------------------------------
describe("deferred categories — always passed to renderWarning", () => {
	it("cold-start: passes exactly the two canonical deferred categories", async () => {
		await runInit(CWD, () => {});

		expect(mockRenderWarning).toHaveBeenCalledWith(
			expect.objectContaining({ deferredCategories: DEFERRED_CATEGORIES }),
		);
	});

	it("all-exists run: still passes the two deferred categories", async () => {
		mockWriteMcpEntry.mockResolvedValue({ status: "exists", message: "already configured" });
		mockWriteMethodology.mockResolvedValue({
			status: "exists",
			category: "methodology",
			filePath: `${CWD}/CLAUDE.md`,
			name: "Methodology pointer",
		});

		await runInit(CWD, () => {});

		expect(mockRenderWarning).toHaveBeenCalledWith(
			expect.objectContaining({ deferredCategories: DEFERRED_CATEGORIES }),
		);
	});

	it("mixed-status run: still passes the two deferred categories", async () => {
		mockInstallAgents.mockResolvedValue([
			makeStep({
				filePath: `${CWD}/.claude/agents/aide/aide-architect.md`,
				name: "aide-architect.md",
				category: "agents",
				status: "would-overwrite",
			}),
		]);

		await runInit(CWD, () => {});

		expect(mockRenderWarning).toHaveBeenCalledWith(
			expect.objectContaining({ deferredCategories: DEFERRED_CATEGORIES }),
		);
	});
});

// ---------------------------------------------------------------------------
// Display-path consistency — log path matches renderWarning skipped displayPath
// ---------------------------------------------------------------------------
describe("display-path consistency", () => {
	it("[exists] per-file log path matches the filePath derivation (relative, forward-slash)", async () => {
		const absolutePath = path.join(CWD, ".aide/docs/index.md");
		mockInstallMethodologyDocs.mockResolvedValue([
			{ status: "exists", category: "methodology", filePath: absolutePath, name: "index.md" },
		]);

		const lines: string[] = [];
		await runInit(CWD, (l) => lines.push(l));

		const logLine = lines.find((l) => l.includes("index.md") && l.startsWith("[exists]"));
		expect(logLine).toBeDefined();
		const displayPath = logLine!.split(" — ")[0].replace("[exists] ", "");
		// Must be forward-slash, relative to CWD
		expect(displayPath).toBe(".aide/docs/index.md");
		expect(displayPath).not.toContain("\\");
	});

	it("[skipped-drift] per-file log path matches what renderWarning receives in skipped", async () => {
		const driftedStep = makeStep({
			filePath: `${CWD}/.claude/commands/aide/research.md`,
			name: "aide:research",
			category: "commands",
			status: "would-overwrite",
		});
		mockScaffoldCommands.mockResolvedValue([driftedStep]);

		const lines: string[] = [];
		await runInit(CWD, (l) => lines.push(l));

		const logLine = lines.find((l) => l.startsWith("[skipped-drift]") && l.includes("research.md"));
		expect(logLine).toBeDefined();
		const logDisplayPath = logLine!.split(" — ")[0].replace("[skipped-drift] ", "");

		const call = mockRenderWarning.mock.calls[0][0];
		const warningEntry = call.skipped.find(
			(r: { displayPath: string }) => r.displayPath.includes("research.md"),
		);
		expect(warningEntry).toBeDefined();
		expect(logDisplayPath).toBe(warningEntry!.displayPath);
	});
});

// ---------------------------------------------------------------------------
// Coverage gap closures — versions.json and README are steps
// ---------------------------------------------------------------------------
describe("coverage gap closure — regression guards for Problem 1", () => {
	it("versions.json is a step: applySteps input includes a step whose filePath ends with versions.json", async () => {
		// compareBytes returns would-create so versions.json goes into toApply
		mockCompareBytes.mockResolvedValue("would-create");

		await runInit(CWD, () => {});

		const [calledWith] = mockApplySteps.mock.calls[0];
		const hasVersionsStep = calledWith.some((s: InitStep) =>
			s.filePath.endsWith("versions.json"),
		);
		expect(hasVersionsStep).toBe(true);
	});

	it("versions.json step shows in the per-file log", async () => {
		mockCompareBytes.mockResolvedValue("would-create");

		const lines: string[] = [];
		await runInit(CWD, (l) => lines.push(l));

		const versionsLine = lines.find((l) => l.includes("versions.json"));
		expect(versionsLine).toBeDefined();
	});

	it("README is a step: applySteps input includes a step whose filePath ends with README.md", async () => {
		const readmeStep = makeStep({
			filePath: `${CWD}/README.md`,
			name: "README.md",
			category: "readme",
			status: "would-create",
		});
		mockScaffoldReadme.mockResolvedValue(readmeStep);

		await runInit(CWD, () => {});

		const [calledWith] = mockApplySteps.mock.calls[0];
		const hasReadmeStep = calledWith.some((s: InitStep) =>
			s.filePath.endsWith("README.md"),
		);
		expect(hasReadmeStep).toBe(true);
	});

	it("README step shows in the per-file log", async () => {
		const readmeStep = makeStep({
			filePath: `${CWD}/README.md`,
			name: "README.md",
			category: "readme",
			status: "would-create",
		});
		mockScaffoldReadme.mockResolvedValue(readmeStep);

		const lines: string[] = [];
		await runInit(CWD, (l) => lines.push(l));

		const readmeLine = lines.find((l) => l.includes("README.md"));
		expect(readmeLine).toBeDefined();
	});

	it("versions.json exists (would-skip from compareBytes) → shows [exists] in log and does NOT go to applySteps", async () => {
		mockCompareBytes.mockResolvedValue("would-skip");

		const lines: string[] = [];
		await runInit(CWD, (l) => lines.push(l));

		const versionsLine = lines.find((l) => l.includes("versions.json"));
		expect(versionsLine).toMatch(/^\[exists\]/);

		const [calledWith] = mockApplySteps.mock.calls[0];
		const inApply = calledWith.some((s: InitStep) => s.filePath.endsWith("versions.json"));
		expect(inApply).toBe(false);
	});
});

// ---------------------------------------------------------------------------
// Step 3 tests — brain.aide scaffold orchestration
// ---------------------------------------------------------------------------

// 3a: vaultPath supplied, no existing brain.aide → scaffold created, MCP logged
describe("3a — vaultPath supplied, brain.aide absent: scaffold is created", () => {
	const VAULT_PATH = "/my/vault";

	beforeEach(() => {
		// Simulate brain.aide not existing: access throws ENOENT.
		const enoent = Object.assign(new Error("ENOENT"), { code: "ENOENT" });
		mockAccess.mockRejectedValue(enoent);
	});

	it("writes .aide/config/brain.aide with the canonical Obsidian content", async () => {
		await runInit(CWD, () => {}, { vaultPath: VAULT_PATH });

		expect(mockObsidianBrainAideTemplate).toHaveBeenCalledWith(VAULT_PATH);
		expect(mockWriteFile).toHaveBeenCalledWith(
			expect.stringContaining("brain.aide"),
			"# canonical brain.aide content",
			"utf-8",
		);
	});

	it("logs [created] .aide/config/brain.aide before the MCP entry log line", async () => {
		const lines: string[] = [];
		await runInit(CWD, (l) => lines.push(l), { vaultPath: VAULT_PATH });

		const brainLine = lines.find((l) => l.includes("brain.aide"));
		expect(brainLine).toMatch(/^\[created\] \.aide\/config\/brain\.aide/);

		const mcpLine = lines.find((l) => l.includes(".mcp.json"));
		expect(mcpLine).toBeDefined();

		expect(lines.indexOf(brainLine!)).toBeLessThan(lines.indexOf(mcpLine!));
	});

	it("passes only the IDE deferred category to renderWarning (brain is resolved)", async () => {
		await runInit(CWD, () => {}, { vaultPath: VAULT_PATH });

		expect(mockRenderWarning).toHaveBeenCalledWith(
			expect.objectContaining({ deferredCategories: DEFERRED_CATEGORIES_WITH_VAULT }),
		);
	});

	it("returns exit code 0", async () => {
		const code = await runInit(CWD, () => {}, { vaultPath: VAULT_PATH });
		expect(code).toBe(0);
	});
});

// 3b: vaultPath absent → no brain.aide written, warning lists new deferred strings
describe("3b — vaultPath absent: no brain.aide scaffold, new deferred-category strings", () => {
	it("does NOT call writeFile for brain.aide", async () => {
		await runInit(CWD, () => {});

		expect(mockWriteFile).not.toHaveBeenCalled();
		expect(mockObsidianBrainAideTemplate).not.toHaveBeenCalled();
	});

	it("does NOT emit a brain.aide log line", async () => {
		const lines: string[] = [];
		await runInit(CWD, (l) => lines.push(l));

		expect(lines.some((l) => l.includes("brain.aide"))).toBe(false);
	});

	it("passes the combined Brain-wiring and IDE deferred-category strings to renderWarning", async () => {
		await runInit(CWD, () => {});

		const call = mockRenderWarning.mock.calls[0][0];
		expect(call.deferredCategories).toContain(
			"Brain wiring (.aide/config/brain.aide + derived brain MCP entry) — open Claude Code and run /aide; the orchestrator will prompt for the vault path, scaffold .aide/config/brain.aide, and tell you to run npx aidemd-mcp sync",
		);
		expect(call.deferredCategories).toContain(
			"IDE configuration — re-run: npx aidemd-mcp init --ide <choice>",
		);
	});

	it("deferred categories no longer reference stale 'Vault path' or 'Brain vault scaffolding' strings", async () => {
		await runInit(CWD, () => {});

		const call = mockRenderWarning.mock.calls[0][0];
		const deferred: string[] = call.deferredCategories as string[];
		expect(deferred.some((s) => s.startsWith("Vault path"))).toBe(false);
		expect(deferred.some((s) => s.startsWith("Brain vault scaffolding"))).toBe(false);
	});

	it("deferred categories no longer split brain config and brain MCP entry into two separate items", async () => {
		await runInit(CWD, () => {});

		const call = mockRenderWarning.mock.calls[0][0];
		const deferred: string[] = call.deferredCategories as string[];
		expect(deferred.some((s) => s.startsWith("Brain config"))).toBe(false);
		expect(deferred.some((s) => s.startsWith("Brain MCP entry"))).toBe(false);
	});
});

// 3c: Second run with vaultPath supplied — fully idempotent (brain.aide exists)
describe("3c — second run with vaultPath: brain.aide already exists, idempotent", () => {
	const VAULT_PATH = "/my/vault";

	beforeEach(() => {
		// Simulate brain.aide already present: access resolves (default).
		mockAccess.mockResolvedValue(undefined);
		mockWriteMcpEntry.mockResolvedValue({ status: "exists", message: "aide and brain MCP server entries already configured" });
	});

	it("does NOT write brain.aide a second time (writeFile is not called)", async () => {
		await runInit(CWD, () => {}, { vaultPath: VAULT_PATH });

		expect(mockWriteFile).not.toHaveBeenCalled();
	});

	it("logs [exists] .aide/config/brain.aide — already present", async () => {
		const lines: string[] = [];
		await runInit(CWD, (l) => lines.push(l), { vaultPath: VAULT_PATH });

		const brainLine = lines.find((l) => l.includes("brain.aide"));
		expect(brainLine).toBe("[exists] .aide/config/brain.aide — already present");
	});

	it("returns exit code 0", async () => {
		const code = await runInit(CWD, () => {}, { vaultPath: VAULT_PATH });
		expect(code).toBe(0);
	});
});

// 3d: User hand-edited brain.aide between runs — edits are respected (not overwritten)
describe("3d — user-edited brain.aide: seed-semantic, never overwritten", () => {
	const VAULT_PATH = "/my/vault";

	beforeEach(() => {
		// Simulate user's edited brain.aide on disk: access resolves.
		mockAccess.mockResolvedValue(undefined);
	});

	it("does NOT overwrite user-edited brain.aide (writeFile not called)", async () => {
		await runInit(CWD, () => {}, { vaultPath: VAULT_PATH });

		// access resolved → brain.aide exists → writeFile must NOT be called
		expect(mockWriteFile).not.toHaveBeenCalled();
	});

	it("logs [exists] brain.aide (user edits preserved)", async () => {
		const lines: string[] = [];
		await runInit(CWD, (l) => lines.push(l), { vaultPath: VAULT_PATH });

		const brainLine = lines.find((l) => l.includes("brain.aide"));
		expect(brainLine).toMatch(/^\[exists\]/);
	});

	it("calls writeMcpEntry with the same vaultPath so it reads the user-edited file", async () => {
		await runInit(CWD, () => {}, { vaultPath: VAULT_PATH });

		// writeMcpEntry reads brain.aide from disk — passing vaultPath ensures it
		// opens the user's version rather than falling back to the in-memory template.
		expect(mockWriteMcpEntry).toHaveBeenCalledWith(CWD, VAULT_PATH);
	});
});

// 5e: user has scaffolded .aide/config/brain.aide via sync or hand-edit before init runs
describe("5e — pre-existing .aide/config/brain.aide: ownership boundary regression guard", () => {
	const VAULT_PATH = "/my/vault";

	beforeEach(() => {
		// Simulate the file already present on disk (e.g., written by sync or hand-edit):
		// access resolves → file exists.
		mockAccess.mockResolvedValue(undefined);
	});

	it("does NOT call writeFile for brain.aide when the file is already present", async () => {
		await runInit(CWD, () => {}, { vaultPath: VAULT_PATH });

		// The existing-file branch must NOT write anything to brain.aide.
		expect(mockWriteFile).not.toHaveBeenCalled();
	});

	it("does NOT call obsidianBrainAideTemplate when the file is already present", async () => {
		await runInit(CWD, () => {}, { vaultPath: VAULT_PATH });

		// The existing-file branch must NOT compute the template content as a fallback —
		// this is the regression guard for the .aide/config/ ownership boundary.
		expect(mockObsidianBrainAideTemplate).not.toHaveBeenCalled();
	});
});
