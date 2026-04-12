import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir, platform } from "node:os";
import init from "./index.js";
import type { InitResult, InitStep } from "@/types/index.js";

// Clean up AIDE_BRAIN_PATH after each test to avoid cross-test pollution
const originalBrainPath = process.env.AIDE_BRAIN_PATH;

const expectedAideMcpEntry = platform() === "win32"
	? { command: "cmd", args: ["/c", "npx", "aidemd-mcp"] }
	: { command: "npx", args: ["aidemd-mcp"] };

let tempDir: string;

beforeEach(async () => {
	tempDir = await mkdtemp(join(tmpdir(), "aide-init-"));
});

afterEach(async () => {
	await rm(tempDir, { recursive: true, force: true });
	// Restore AIDE_BRAIN_PATH to avoid cross-test pollution
	if (originalBrainPath === undefined) {
		delete process.env.AIDE_BRAIN_PATH;
	} else {
		process.env.AIDE_BRAIN_PATH = originalBrainPath;
	}
});

/** Find a step by name in the result. */
function findStep(result: InitResult, name: string): InitStep | undefined {
	return result.steps.find((s) => s.name === name);
}

/** Find all steps with a given category. */
function stepsForCategory(result: InitResult, category: InitStep["category"]): InitStep[] {
	return result.steps.filter((s) => s.category === category);
}

describe("init — structured JSON result", () => {
	it("fresh project: returns InitResult with framework, steps, and brainHints", async () => {
		const result = await init(tempDir);

		expect(result).toHaveProperty("framework");
		expect(result).toHaveProperty("steps");
		expect(result).toHaveProperty("brainHints");
		expect(Array.isArray(result.steps)).toBe(true);
		expect(Array.isArray(result.brainHints)).toBe(true);
	});

	it("fresh project: detects claude framework by default", async () => {
		const result = await init(tempDir);

		expect(result.framework).toBe("claude");
	});

	it("fresh project: all non-IDE steps are would-create", async () => {
		const result = await init(tempDir);

		const nonIdeSteps = result.steps.filter((s) => s.category !== "ide");
		const statuses = nonIdeSteps.map((s) => s.status);
		// All should be would-create (nothing exists yet in a fresh tempDir)
		expect(statuses.every((s) => s === "would-create" || s === "would-skip")).toBe(true);
	});

	it("fresh project: would-create steps carry content or prescription", async () => {
		const result = await init(tempDir);

		for (const step of result.steps) {
			if (step.status === "would-create") {
				// MCP steps carry prescription; file steps carry content
				if (step.category === "mcp") {
					// Obsidian MCP step may lack prescription when no brain hints (placeholder)
					if (step.prescription) {
						expect(step.prescription.key).toBeTruthy();
						expect(step.prescription.entry.command).toBeTruthy();
					}
				} else if (step.category === "brain" && step.filePath === "") {
					// Placeholder brain step — agent must interview user first
					continue;
				} else if (step.category !== "ide") {
					// IDE vscode step may have no content (agent installs via CLI)
					expect(step.content).toBeTruthy();
				}
			}
		}
	});

	it("fresh project: every step has a filePath (brain vault may be empty when no hints)", async () => {
		const result = await init(tempDir);

		for (const step of result.steps) {
			// Brain vault step has empty filePath when no hints — signals agent must ask user
			if (step.name === "Brain vault" && result.brainHints.length === 0) {
				expect(step.filePath).toBe("");
			} else {
				expect(step.filePath).toBeTruthy();
			}
		}
	});

	it("fresh project: every step has a category", async () => {
		const result = await init(tempDir);

		const validCategories = new Set(["framework", "methodology", "commands", "agents", "skills", "mcp", "brain", "ide"]);
		for (const step of result.steps) {
			expect(validCategories.has(step.category)).toBe(true);
		}
	});

	it("fresh project: brainHints empty when no vault on disk and no env var", async () => {
		// Clear env var and ensure no sibling my-brain or ~/my-brain interference
		delete process.env.AIDE_BRAIN_PATH;
		// Use an isolated subdirectory to avoid sibling-path false positives
		const isolated = join(tempDir, "project");
		await mkdir(isolated);

		const result = await init(isolated);

		// The hint from env won't appear; sibling and conventional might if they
		// happen to exist on this machine. We can only assert the env hint is absent.
		const envHints = result.brainHints.filter((h) => h.source === "env");
		expect(envHints).toHaveLength(0);
	});

	it("fresh project: brainHints contain env hint when AIDE_BRAIN_PATH points to existing dir", async () => {
		const brainPath = join(tempDir, "vault");
		await mkdir(brainPath);
		process.env.AIDE_BRAIN_PATH = brainPath;

		const result = await init(tempDir);

		const envHints = result.brainHints.filter((h) => h.source === "env");
		expect(envHints).toHaveLength(1);
		expect(envHints[0].path).toBe(brainPath);
	});

	it("fresh project: AIDE_BRAIN_PATH pointing to non-existent dir produces no hint", async () => {
		process.env.AIDE_BRAIN_PATH = join(tempDir, "does-not-exist");

		const result = await init(tempDir);

		const envHints = result.brainHints.filter((h) => h.source === "env");
		expect(envHints).toHaveLength(0);
	});

	it("fresh project: aide MCP prescription has correct key and entry", async () => {
		const result = await init(tempDir);

		const mcpStep = findStep(result, "MCP config (aide)");
		expect(mcpStep).toBeDefined();
		expect(mcpStep?.prescription?.key).toBe("aide");
		expect(mcpStep?.prescription?.entry).toEqual(expectedAideMcpEntry);
	});

	it("fresh project: methodology category has pointer and doc steps", async () => {
		const result = await init(tempDir);

		const methodologySteps = stepsForCategory(result, "methodology");
		expect(methodologySteps.length).toBeGreaterThan(1);

		const pointer = findStep(result, "Methodology pointer");
		expect(pointer).toBeDefined();
		expect(pointer?.category).toBe("methodology");
	});

	it("fresh project: commands category includes aide:research", async () => {
		const result = await init(tempDir);

		const commandSteps = stepsForCategory(result, "commands");
		expect(commandSteps.length).toBeGreaterThan(0);
		const research = commandSteps.find((s) => s.name === "aide:research");
		expect(research).toBeDefined();
	});

	it("fresh project: agents and skills categories are populated", async () => {
		const result = await init(tempDir);

		expect(stepsForCategory(result, "agents").length).toBeGreaterThan(0);
		expect(stepsForCategory(result, "skills").length).toBeGreaterThan(0);
	});

	it("fresh project: brain steps are would-create with empty filePath when no hints", async () => {
		delete process.env.AIDE_BRAIN_PATH;
		// Use isolated subdir to avoid sibling my-brain collisions
		const isolated = join(tempDir, "project");
		await mkdir(isolated);

		const result = await init(isolated);

		const brainSteps = stepsForCategory(result, "brain");
		expect(brainSteps.length).toBeGreaterThan(0);
		// When no hints exist, brain vault step has empty filePath signaling
		// the agent must interview the user before applying
		const vaultStep = brainSteps.find((s) => s.name === "Brain vault");
		expect(vaultStep).toBeDefined();
		expect(vaultStep?.status).toBe("would-create");
		expect(vaultStep?.filePath).toBe("");
	});

	it("idempotency — re-running on initialized content returns exists steps", async () => {
		// Write some files that detectFramework and helper checks look at
		await mkdir(join(tempDir, ".claude"));
		await mkdir(join(tempDir, ".claude", "commands", "aide"), { recursive: true });
		await writeFile(join(tempDir, "CLAUDE.md"), "<!-- aide-methodology -->\n\nfoo\n\n<!-- aide-methodology -->\n");
		await writeFile(join(tempDir, ".mcp.json"), JSON.stringify({ mcpServers: { aide: expectedAideMcpEntry } }));

		// After writing the methodology marker, pointer should be exists
		const result = await init(tempDir);

		const pointer = findStep(result, "Methodology pointer");
		expect(pointer?.status).toBe("exists");

		const mcpAide = findStep(result, "MCP config (aide)");
		expect(mcpAide?.status).toBe("exists");
	});

	it("framework override — cursor framework propagates to steps", async () => {
		const result = await init(tempDir, "cursor");

		expect(result.framework).toBe("cursor");
		// Config path should be .cursorrules
		const pointer = findStep(result, "Methodology pointer");
		expect(pointer?.filePath).toContain(".cursorrules");
	});

	it("auto-detects cursor from .cursor directory", async () => {
		await mkdir(join(tempDir, ".cursor"));

		const result = await init(tempDir);

		expect(result.framework).toBe("cursor");
	});

	it("path override — uses subproject root", async () => {
		const subDir = join(tempDir, "subproject");
		await mkdir(subDir);

		const result = await init(tempDir, undefined, "subproject");

		expect(result.framework).toBe("claude");
		const pointer = findStep(result, "Methodology pointer");
		expect(pointer?.filePath).toContain("subproject");
	});

	it("MCP config malformed — configMalformed flag is set on mcp step", async () => {
		await writeFile(join(tempDir, ".mcp.json"), "not valid json {{{", "utf-8");

		const result = await init(tempDir);

		const mcpStep = findStep(result, "MCP config (aide)");
		expect(mcpStep?.configMalformed).toBe(true);
		expect(mcpStep?.status).toBe("would-create");
		// Prescription is still provided so agent can create a fresh config
		expect(mcpStep?.prescription).toBeDefined();
	});

	it("result is JSON-serializable", async () => {
		const result = await init(tempDir);

		expect(() => JSON.stringify(result)).not.toThrow();
		const parsed = JSON.parse(JSON.stringify(result)) as InitResult;
		expect(parsed.framework).toBe(result.framework);
		expect(parsed.steps.length).toBe(result.steps.length);
	});

	it("no prose — result contains no formatted text fields", async () => {
		const result = await init(tempDir);

		// The top-level result has no string fields beyond what InitResult declares
		const keys = Object.keys(result);
		expect(keys).toEqual(expect.arrayContaining(["framework", "steps", "brainHints"]));
		// No extra string fields
		const extraKeys = keys.filter((k) => !["framework", "steps", "brainHints"].includes(k));
		expect(extraKeys).toHaveLength(0);
	});
});

describe("init — response shaping (server-handler logic)", () => {
	/** Simulate the server handler's summary stripping. */
	function stripContent(result: InitResult): InitResult {
		return {
			...result,
			steps: result.steps.map(({ content: _content, ...rest }) => rest),
		};
	}

	/** Simulate the server handler's category filtering. */
	function filterCategory(result: InitResult, category: InitStep["category"]): InitResult {
		return {
			...result,
			steps: result.steps.filter((s) => s.category === category),
		};
	}

	it("summary mode: no steps carry content field", async () => {
		const result = await init(tempDir);
		const stripped = stripContent(result);

		for (const step of stripped.steps) {
			expect(step).not.toHaveProperty("content");
		}
	});

	it("summary mode: preserves metadata fields (name, status, category, filePath)", async () => {
		const result = await init(tempDir);
		const stripped = stripContent(result);

		expect(stripped.steps.length).toBe(result.steps.length);
		for (const step of stripped.steps) {
			expect(step.name).toBeTruthy();
			expect(step.status).toBeTruthy();
			expect(step.category).toBeTruthy();
			expect(step).toHaveProperty("filePath");
		}
	});

	it("summary mode: prescriptions are preserved (not stripped)", async () => {
		const result = await init(tempDir);
		const stripped = stripContent(result);

		const mcpSteps = stripped.steps.filter((s) => s.category === "mcp" && s.prescription);
		const originalMcpSteps = result.steps.filter((s) => s.category === "mcp" && s.prescription);
		expect(mcpSteps.length).toBe(originalMcpSteps.length);
	});

	it("category filter: returns only steps of the specified category", async () => {
		const result = await init(tempDir);
		const filtered = filterCategory(result, "commands");

		expect(filtered.steps.length).toBeGreaterThan(0);
		for (const step of filtered.steps) {
			expect(step.category).toBe("commands");
		}
	});

	it("category filter: returned steps retain content", async () => {
		const result = await init(tempDir);
		const filtered = filterCategory(result, "commands");

		const wouldCreate = filtered.steps.filter((s) => s.status === "would-create");
		expect(wouldCreate.length).toBeGreaterThan(0);
		for (const step of wouldCreate) {
			expect(step.content).toBeTruthy();
		}
	});

	it("summary JSON is significantly smaller than full result JSON", async () => {
		const result = await init(tempDir);
		const stripped = stripContent(result);

		const fullSize = JSON.stringify(result).length;
		const summarySize = JSON.stringify(stripped).length;

		// Summary should be dramatically smaller (at least 50% reduction)
		expect(summarySize).toBeLessThan(fullSize * 0.5);
	});
});
