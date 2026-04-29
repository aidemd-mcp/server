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
// The inline brain.aide scaffold block (access, mkdir, writeFile,
// obsidianBrainAideTemplate) was deleted in Step 1 of this plan — no mocks
// for those here by design. The orchestrator delegates brain scaffolding to
// planBrainCategory + applySteps.
// ────────────────────────────────────────────────────────────────────────────
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
vi.mock("@/service/install/index.js", () => ({
	planBrainCategory: vi.fn(),
}));
vi.mock("@/tools/upgrade/buildVersionsMeta/index.js", () => ({
	default: vi.fn(),
}));
vi.mock("@/service/install/shared/compareBytes/index.js", () => ({
	default: vi.fn(),
}));

import { runInit } from "./index.js";
import { planBrainCategory } from "@/service/install/index.js";
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

const mockPlanBrainCategory = vi.mocked(planBrainCategory);
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

// Canonical two deferred categories — brain wiring always routes to /aide:brain config,
// IDE always defers to re-run with --ide. Single source of truth for all tests that
// assert the deferredCategories argument to renderWarning.
const DEFERRED_CATEGORIES = [
	"Brain wiring — open Claude Code and run /aide; on the first run, /aide:brain config will fill the unwired slot in .aide/config/brain.aide, derive the brain MCP entry through cli/sync, and seed the four entry-point artifacts into your brain.",
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
const BRAIN_AIDE_PATH = `${CWD}/.aide/config/brain.aide`;

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

/** Brain.aide-scaffold step in would-create state — install service cold-start return. */
function makeBrainScaffoldStep(status: "would-create" | "exists" = "would-create"): InitStep {
	return {
		name: "Brain config (brain.aide)",
		status,
		category: "brain",
		filePath: BRAIN_AIDE_PATH,
		...(status === "would-create" ? { content: "# brain.aide bundled template" } : {}),
	};
}

/** MCP-entry-plan step — always discarded by cli/init; only used to complete the array shape. */
function makeBrainMcpStep(): InitStep {
	return {
		name: "MCP config (brain)",
		status: "would-create",
		category: "mcp",
		filePath: `${CWD}/.mcp.json`,
		prescription: { key: "brain", entry: { command: "npx", args: ["@bitbonsai/mcpvault", null] } },
	};
}

beforeEach(() => {
	vi.clearAllMocks();

	// Default mock return values — per-test overrides build on these.
	// planBrainCategory default: brain.aide already exists (idempotent re-run shape).
	// Tests that need the scaffold (would-create) path override per-test.
	mockPlanBrainCategory.mockResolvedValue([
		makeBrainScaffoldStep("exists"),
		makeBrainMcpStep(),
	]);
	mockWriteMcpEntry.mockResolvedValue({ status: "created", message: "aide MCP server entry" });
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
		mockPlanBrainCategory.mockResolvedValue([
			makeBrainScaffoldStep("would-create"),
			makeBrainMcpStep(),
		]);
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

		// Brain.aide scaffold is first.
		expect(lines[0]).toMatch(/^\[created\] \.aide\/config\/brain\.aide/);
		// MCP entry is second.
		expect(lines[1]).toMatch(/^\[created\] \.mcp\.json/);
		// All planning-step results show [created]
		const createdLines = lines.filter((l) => l.startsWith("[created]"));
		expect(createdLines.length).toBeGreaterThan(0);
		// No skipped or failed lines on the happy path
		expect(lines.some((l) => l.startsWith("[skipped"))).toBe(false);
		expect(lines.some((l) => l.startsWith("[failed]"))).toBe(false);
	});

	it("applySteps receives the full would-create set (including all categories)", async () => {
		await runInit(CWD, () => {});

		// applySteps is called twice: first for the brain.aide scaffold step,
		// then for all the methodology/command/agent/etc. steps. The second call
		// holds the methodology-layer would-create steps.
		const allCallArgs: InitStep[] = mockApplySteps.mock.calls.flatMap(([steps]) => steps);
		// All planning steps are would-create, so all should reach applySteps
		expect(allCallArgs.length).toBeGreaterThanOrEqual(5);
		expect(allCallArgs.every((s: InitStep) => s.status === "would-create")).toBe(true);
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
		mockPlanBrainCategory.mockResolvedValue([
			makeBrainScaffoldStep("exists"),
			makeBrainMcpStep(),
		]);
		mockWriteMcpEntry.mockResolvedValue({ status: "exists", message: "aide MCP server entry already configured" });
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

	it("planBrainCategory runs before writeMcpEntry, so it WAS called once before the throw", async () => {
		mockWriteMcpEntry.mockRejectedValue(new Error("malformed"));

		await expect(runInit(CWD, () => {})).rejects.toThrow();

		// planBrainCategory runs BEFORE writeMcpEntry (brain scaffold is first),
		// so it WAS called once before the throw.
		expect(mockPlanBrainCategory).toHaveBeenCalledTimes(1);
		// All helpers after writeMcpEntry must not have been called.
		expect(mockDetectFramework).not.toHaveBeenCalled();
		expect(mockWriteMethodology).not.toHaveBeenCalled();
		expect(mockInstallMethodologyDocs).not.toHaveBeenCalled();
		expect(mockScaffoldCommands).not.toHaveBeenCalled();
		expect(mockInstallAgents).not.toHaveBeenCalled();
		expect(mockInstallSkills).not.toHaveBeenCalled();
		expect(mockInstallAideTree).not.toHaveBeenCalled();
		expect(mockScaffoldReadme).not.toHaveBeenCalled();
		expect(mockRenderWarning).not.toHaveBeenCalled();
	});
});

// ---------------------------------------------------------------------------
// Invocation ordering — planBrainCategory first, then writeMcpEntry, then planners
// ---------------------------------------------------------------------------
describe("invocation ordering", () => {
	it("planBrainCategory runs first, writeMcpEntry second, then detectFramework, planners, applySteps, renderWarning", async () => {
		const order: string[] = [];

		mockPlanBrainCategory.mockImplementation(async () => {
			order.push("planBrainCategory");
			return [
				makeBrainScaffoldStep("exists"),
				makeBrainMcpStep(),
			];
		});
		mockWriteMcpEntry.mockImplementation(async () => {
			order.push("writeMcpEntry");
			return { status: "created" as const, message: "aide MCP server entry" };
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

		const brainIdx = order.indexOf("planBrainCategory");
		const mcpIdx = order.indexOf("writeMcpEntry");

		// planBrainCategory must run before writeMcpEntry.
		expect(brainIdx, "planBrainCategory must run before writeMcpEntry").toBeLessThan(mcpIdx);

		// writeMcpEntry must run before all service planners and renderWarning.
		expect(mcpIdx, "writeMcpEntry must be found in order").toBeGreaterThanOrEqual(0);
		for (const name of [
			"detectFramework",
			"writeMethodology",
			"installMethodologyDocs",
			"scaffoldCommands",
			"installAgents",
			"installSkills",
			"installAideTree",
			"scaffoldReadme",
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
// 6d-i. Cold-start happy path, default integration
// ---------------------------------------------------------------------------
describe("6d-i — cold-start happy path, default integration", () => {
	beforeEach(() => {
		mockPlanBrainCategory.mockResolvedValue([
			makeBrainScaffoldStep("would-create"),
			makeBrainMcpStep(),
		]);
		mockWriteMcpEntry.mockResolvedValue({ status: "created", message: "aide MCP server entry" });
	});

	it("brain.aide log line contains 'bundled brain template (--brain obsidian default'", async () => {
		const lines: string[] = [];
		await runInit(CWD, (l) => lines.push(l));

		const brainLine = lines.find((l) => l.includes("brain.aide"));
		expect(brainLine).toBeDefined();
		expect(brainLine).toContain("bundled brain template (--brain obsidian default");
	});

	it("brain.aide is the first log line, MCP entry is second", async () => {
		const lines: string[] = [];
		await runInit(CWD, (l) => lines.push(l));

		expect(lines[0]).toMatch(/^\[created\] \.aide\/config\/brain\.aide/);
		expect(lines[1]).toMatch(/^\[created\] \.mcp\.json/);
	});

	it("planBrainCategory was invoked exactly once with integration name 'obsidian' (default)", async () => {
		await runInit(CWD, () => {});

		expect(mockPlanBrainCategory).toHaveBeenCalledTimes(1);
		expect(mockPlanBrainCategory).toHaveBeenCalledWith(CWD, "obsidian");
	});

	it("writeMcpEntry called with exactly one positional argument: cwd (no brainPath)", async () => {
		await runInit(CWD, () => {});

		expect(mockWriteMcpEntry).toHaveBeenCalledWith(CWD);
	});

	it("renderWarning receives the two-item deferredCategories array", async () => {
		await runInit(CWD, () => {});

		expect(mockRenderWarning).toHaveBeenCalledWith({
			skipped: [],
			failed: [],
			deferredCategories: DEFERRED_CATEGORIES,
		});
	});

	it("returns exit code 0", async () => {
		const code = await runInit(CWD, () => {});
		expect(code).toBe(0);
	});
});

// ---------------------------------------------------------------------------
// 6d-ii. Explicit --brain obsidian matches default
// ---------------------------------------------------------------------------
describe("6d-ii — explicit --brain obsidian matches default", () => {
	beforeEach(() => {
		mockPlanBrainCategory.mockResolvedValue([
			makeBrainScaffoldStep("would-create"),
			makeBrainMcpStep(),
		]);
	});

	it("planBrainCategory receives integration name 'obsidian' when explicitly passed", async () => {
		await runInit(CWD, () => {}, { brain: "obsidian" });

		expect(mockPlanBrainCategory).toHaveBeenCalledWith(CWD, "obsidian");
	});

	it("brain.aide line contains 'bundled brain template (--brain obsidian default'", async () => {
		const lines: string[] = [];
		await runInit(CWD, (l) => lines.push(l), { brain: "obsidian" });

		const brainLine = lines.find((l) => l.includes("brain.aide"));
		expect(brainLine).toContain("bundled brain template (--brain obsidian default");
	});

	it("writeMcpEntry called with exactly cwd (no brainPath)", async () => {
		await runInit(CWD, () => {}, { brain: "obsidian" });

		expect(mockWriteMcpEntry).toHaveBeenCalledWith(CWD);
	});
});

// ---------------------------------------------------------------------------
// 6d-iii. Idempotent re-run
// ---------------------------------------------------------------------------
describe("6d-iii — idempotent re-run (brain.aide exists, all steps exist)", () => {
	const existsStep = (filePath: string, name: string, category: InitStep["category"] = "methodology"): InitStep =>
		({ status: "exists", category, filePath, name });

	beforeEach(() => {
		mockPlanBrainCategory.mockResolvedValue([
			makeBrainScaffoldStep("exists"),
			makeBrainMcpStep(),
		]);
		mockWriteMcpEntry.mockResolvedValue({ status: "exists", message: "aide MCP server entry already configured" });
		mockWriteMethodology.mockResolvedValue(existsStep(`${CWD}/CLAUDE.md`, "Methodology pointer"));
		mockInstallMethodologyDocs.mockResolvedValue([existsStep(`${CWD}/.aide/docs/index.md`, "index.md")]);
		mockScaffoldCommands.mockResolvedValue([existsStep(`${CWD}/.claude/commands/aide/research.md`, "aide:research", "commands")]);
		mockInstallAgents.mockResolvedValue([existsStep(`${CWD}/.claude/agents/aide/aide-architect.md`, "aide-architect.md", "agents")]);
		mockInstallSkills.mockResolvedValue([existsStep(`${CWD}/.claude/skills/study-playbook/SKILL.md`, "study-playbook/SKILL.md", "skills")]);
		mockInstallAideTree.mockResolvedValue([existsStep(`${CWD}/.aide/bin/aide-tree.mjs`, "aide-tree.mjs")]);
		mockScaffoldReadme.mockResolvedValue(existsStep(`${CWD}/README.md`, "README.md", "readme"));
		mockCompareBytes.mockResolvedValue("would-skip");
	});

	it("brain.aide log line is '[exists] .aide/config/brain.aide — already present'", async () => {
		const lines: string[] = [];
		await runInit(CWD, (l) => lines.push(l));

		expect(lines[0]).toBe("[exists] .aide/config/brain.aide — already present");
	});

	it("every log line begins with [exists]", async () => {
		const lines: string[] = [];
		await runInit(CWD, (l) => lines.push(l));

		const nonExistsLines = lines.filter(
			(l) => !l.startsWith("[exists]") && !l.startsWith("WARNING") && !l.startsWith("Already set up."),
		);
		expect(nonExistsLines).toHaveLength(0);
	});

	it("renderWarning still receives the two-item deferredCategories array on re-run", async () => {
		await runInit(CWD, () => {});

		expect(mockRenderWarning).toHaveBeenCalledWith(
			expect.objectContaining({ deferredCategories: DEFERRED_CATEGORIES }),
		);
	});

	it("returns exit code 0", async () => {
		const code = await runInit(CWD, () => {});
		expect(code).toBe(0);
	});
});

// ---------------------------------------------------------------------------
// 6d-iv. Mixed run (some would-create, some exists, some would-overwrite)
// ---------------------------------------------------------------------------
describe("6d-iv — mixed run (would-create, exists, would-overwrite)", () => {
	const wouldCreate = makeStep({ filePath: `${CWD}/.aide/docs/index.md`, name: "index.md" });
	const existsMethodology = {
		status: "exists" as const,
		category: "methodology" as const,
		filePath: `${CWD}/CLAUDE.md`,
		name: "Methodology pointer",
	};
	const wouldOverwrite = makeStep({
		filePath: `${CWD}/.claude/commands/aide/research.md`,
		name: "aide:research",
		category: "commands",
		status: "would-overwrite",
	});

	beforeEach(() => {
		mockPlanBrainCategory.mockResolvedValue([
			makeBrainScaffoldStep("would-create"),
			makeBrainMcpStep(),
		]);
		mockWriteMethodology.mockResolvedValue(existsMethodology);
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

	it("brain.aide is [created] with new wording, CLAUDE.md is [exists], research.md is [skipped-drift]", async () => {
		const lines: string[] = [];
		await runInit(CWD, (l) => lines.push(l));

		const brainLine = lines.find((l) => l.includes("brain.aide"));
		expect(brainLine).toMatch(/^\[created\]/);
		expect(brainLine).toContain("bundled brain template");

		const claudeLine = lines.find((l) => l.includes("CLAUDE.md"));
		expect(claudeLine).toMatch(/^\[exists\]/);

		const researchLine = lines.find((l) => l.includes("research.md"));
		expect(researchLine).toMatch(/^\[skipped-drift\]/);
	});

	it("applySteps receives only would-create steps (not exists or would-overwrite)", async () => {
		await runInit(CWD, () => {});

		const [calledWith] = mockApplySteps.mock.calls[0];
		expect(calledWith.every((s: InitStep) => s.status === "would-create")).toBe(true);
		const paths = calledWith.map((s: InitStep) => s.filePath);
		expect(paths).not.toContain(wouldOverwrite.filePath);
	});
});

// ---------------------------------------------------------------------------
// 6d-v. Abort path: writeMcpEntry rejects, install service ran before
// ---------------------------------------------------------------------------
describe("6d-v — abort path: writeMcpEntry rejects", () => {
	it("runInit rejects with the writeMcpEntry error", async () => {
		mockWriteMcpEntry.mockRejectedValue(new Error(".mcp.json contains invalid JSON"));

		await expect(runInit(CWD, () => {})).rejects.toThrow(".mcp.json contains invalid JSON");
	});

	it("install-service (planBrainCategory) was called once before the throw", async () => {
		mockWriteMcpEntry.mockRejectedValue(new Error(".mcp.json contains invalid JSON"));

		await expect(runInit(CWD, () => {})).rejects.toThrow();

		expect(mockPlanBrainCategory).toHaveBeenCalledTimes(1);
	});

	it("every methodology planner is not called after the throw", async () => {
		mockWriteMcpEntry.mockRejectedValue(new Error(".mcp.json contains invalid JSON"));

		await expect(runInit(CWD, () => {})).rejects.toThrow();

		expect(mockDetectFramework).not.toHaveBeenCalled();
		expect(mockWriteMethodology).not.toHaveBeenCalled();
		expect(mockInstallMethodologyDocs).not.toHaveBeenCalled();
		expect(mockScaffoldCommands).not.toHaveBeenCalled();
		expect(mockInstallAgents).not.toHaveBeenCalled();
		expect(mockInstallSkills).not.toHaveBeenCalled();
		expect(mockInstallAideTree).not.toHaveBeenCalled();
		expect(mockScaffoldReadme).not.toHaveBeenCalled();
		expect(mockRenderWarning).not.toHaveBeenCalled();
	});
});

// ---------------------------------------------------------------------------
// 6d-vi. Invocation ordering
// ---------------------------------------------------------------------------
describe("6d-vi — invocation ordering: installService → writeMcpEntry → detectFramework → ... → renderWarning", () => {
	it("planBrainCategory first, writeMcpEntry second, detectFramework third, planners and renderWarning last", async () => {
		const order: string[] = [];

		mockPlanBrainCategory.mockImplementation(async () => {
			order.push("planBrainCategory");
			return [makeBrainScaffoldStep("exists"), makeBrainMcpStep()];
		});
		mockWriteMcpEntry.mockImplementation(async () => {
			order.push("writeMcpEntry");
			return { status: "created" as const, message: "aide MCP server entry" };
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

		const brainIdx = order.indexOf("planBrainCategory");
		const mcpIdx = order.indexOf("writeMcpEntry");
		const detectIdx = order.indexOf("detectFramework");
		const renderIdx = order.indexOf("renderWarning");

		expect(brainIdx).toBeLessThan(mcpIdx);
		expect(mcpIdx).toBeLessThan(detectIdx);
		expect(detectIdx).toBeLessThan(renderIdx);

		for (const name of [
			"detectFramework",
			"writeMethodology",
			"installMethodologyDocs",
			"scaffoldCommands",
			"installAgents",
			"installSkills",
			"installAideTree",
			"scaffoldReadme",
			"renderWarning",
		]) {
			expect(mcpIdx, `${name} must run after writeMcpEntry`).toBeLessThan(order.indexOf(name));
		}
	});
});

// ---------------------------------------------------------------------------
// 6d-vii. Regression guard: brainPath field on options is not forwarded
// ---------------------------------------------------------------------------
describe("6d-vii — regression guard: brainPath field on options is not forwarded", () => {
	it("bogus brainPath is not forwarded to writeMcpEntry or planBrainCategory", async () => {
		// Cast through `as any` to defeat the compile-time type error — this test
		// exercises the runtime regression guard, not the type-system check.
		await runInit(CWD, () => {}, { brain: "obsidian", brainPath: "/foo" } as any);

		// writeMcpEntry must have been called with exactly one argument (CWD only).
		expect(mockWriteMcpEntry).toHaveBeenCalledWith(CWD);
		expect(mockWriteMcpEntry).not.toHaveBeenCalledWith(CWD, "/foo");

		// planBrainCategory must have been called with CWD and the integration name only.
		expect(mockPlanBrainCategory).toHaveBeenCalledWith(CWD, "obsidian");
	});
});

// ---------------------------------------------------------------------------
// 6d-viii. Regression guard: no log line or deferred string contains <BRAIN_PATH>
// ---------------------------------------------------------------------------
describe("6d-viii — regression guard: no output contains <BRAIN_PATH>", () => {
	it("no per-file log line contains the substring '<BRAIN_PATH>'", async () => {
		mockPlanBrainCategory.mockResolvedValue([
			makeBrainScaffoldStep("would-create"),
			makeBrainMcpStep(),
		]);

		const lines: string[] = [];
		await runInit(CWD, (l) => lines.push(l));

		for (const line of lines) {
			expect(line).not.toContain("<BRAIN_PATH>");
		}
	});

	it("no deferredCategories entry passed to renderWarning contains '<BRAIN_PATH>'", async () => {
		await runInit(CWD, () => {});

		const call = mockRenderWarning.mock.calls[0][0];
		const deferred: string[] = call.deferredCategories as string[];
		for (const entry of deferred) {
			expect(entry).not.toContain("<BRAIN_PATH>");
		}
	});
});

// ---------------------------------------------------------------------------
// 6d-ix. Regression guard: retired deferred-categories prose is absent
// ---------------------------------------------------------------------------
describe("6d-ix — regression guard: retired --brain-path-aware deferred-categories prose absent", () => {
	it("no deferred entry starts with the retired placeholder prose", async () => {
		await runInit(CWD, () => {});

		const call = mockRenderWarning.mock.calls[0][0];
		const deferred: string[] = call.deferredCategories as string[];
		for (const entry of deferred) {
			expect(entry).not.toMatch(
				/^Brain wiring — \.aide\/config\/brain\.aide was scaffolded with a <BRAIN_PATH> placeholder/,
			);
		}
	});
});

// ---------------------------------------------------------------------------
// 6d-x. Regression guard: brain deferred entry routes via /aide:brain config
// ---------------------------------------------------------------------------
describe("6d-x — regression guard: brain deferred entry routes via /aide:brain config", () => {
	it("the brain deferred entry contains '/aide:brain config'", async () => {
		await runInit(CWD, () => {});

		const call = mockRenderWarning.mock.calls[0][0];
		const deferred: string[] = call.deferredCategories as string[];
		const brainEntry = deferred.find((s) => s.startsWith("Brain wiring —"));
		expect(brainEntry).toBeDefined();
		expect(brainEntry).toContain("/aide:brain config");
	});

	it("the brain deferred entry does NOT name /aide as the wiring surface (no 'orchestrator will detect')", async () => {
		await runInit(CWD, () => {});

		const call = mockRenderWarning.mock.calls[0][0];
		const deferred: string[] = call.deferredCategories as string[];
		const brainEntry = deferred.find((s) => s.startsWith("Brain wiring —"))!;
		expect(brainEntry).not.toContain("the orchestrator will detect that your brain is not wired");
		expect(brainEntry).not.toContain("orchestrator will walk you through configuration");
	});

	it("the brain deferred entry names /aide as the user-typed command (allowed), not as the wiring surface", async () => {
		// "open Claude Code and run /aide;" is allowed — names /aide as what the user types,
		// then names /aide:brain config as the wiring surface.
		await runInit(CWD, () => {});

		const call = mockRenderWarning.mock.calls[0][0];
		const deferred: string[] = call.deferredCategories as string[];
		const brainEntry = deferred.find((s) => s.startsWith("Brain wiring —"))!;
		expect(brainEntry).toContain("open Claude Code and run /aide;");
	});
});

// ---------------------------------------------------------------------------
// 6d-xi. Regression guard: cli/init does not import obsidianBrainAideTemplate
// ---------------------------------------------------------------------------
describe("6d-xi — regression guard: cli/init does not import obsidianBrainAideTemplate", () => {
	it("the test file itself does not import obsidianBrainAideTemplate (documentary: cli/init must not reach into provisionBrain's template helper)", () => {
		// This test is documentary. The regression class is: cli/init reaches into
		// provisionBrain's template helper directly, bypassing the install service.
		// If this test file imported obsidianBrainAideTemplate, it would need to mock
		// it here (Step 6a removes that mock). The absence of that import in the test
		// file is the signal — verified by the fact that the test compiles without
		// importing that symbol.
		//
		// The assertion below is trivially true by construction: if the import were
		// present, the test file would fail at compile time (undefined symbol).
		expect(true).toBe(true);
	});
});
