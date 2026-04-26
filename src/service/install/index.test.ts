import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, mkdir, writeFile, rm, access, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir, platform } from "node:os";
import init from "./index.js";
import applySteps from "./applySteps/index.js";
import { composeStub } from "./writeMethodology/index.js";
import type { InitResult, InitStep } from "@/types/index.js";

/** Check if a path exists on disk. */
async function pathExists(p: string): Promise<boolean> {
	try {
		await access(p);
		return true;
	} catch {
		return false;
	}
}

// Clean up AIDE_BRAIN_PATH after each test to avoid cross-test pollution
const originalBrainPath = process.env.AIDE_BRAIN_PATH;

const expectedAideMcpEntry =
	platform() === "win32"
		? { command: "cmd", args: ["/c", "npx", "@aidemd-mcp/server"] }
		: { command: "npx", args: ["@aidemd-mcp/server"] };

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
					// MCP steps carry a prescription when the agent has confirmed a path;
					// the brain MCP step always carries a prescription (even with empty path).
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

	it("fresh project: every step has a filePath (brain placeholder steps have empty filePath when no brainPath supplied)", async () => {
		const result = await init(tempDir);

		// When no explicit brainPath is supplied, brain placeholder steps have empty
		// filePaths — this signals the agent must interview the user before applying.
		// "Brain config (brain.aide)" is now the first of the five placeholder steps
		// and also carries an empty filePath. The MCP config (brain) step retains a
		// real filePath (the .mcp.json path) because the consumer still needs it.
		const brainPlaceholders = new Set(["Brain config (brain.aide)", "Brain root directories", "Playbook hub", "Research hub"]);

		for (const step of result.steps) {
			if (brainPlaceholders.has(step.name)) {
				// Placeholder brain steps always have empty filePath when no brainPath supplied
				expect(step.filePath).toBe("");
			} else if (step.category === "readme" && step.status === "would-create" && step.filePath !== "") {
				// README step on a fresh project: would-create with a real filePath (creates README.md)
				expect(step.filePath).toBeTruthy();
				expect(step.content).toBeTruthy();
			} else {
				expect(step.filePath).toBeTruthy();
			}
		}
	});

	it("fresh project: every step has a category", async () => {
		const result = await init(tempDir);

		const validCategories = new Set(["framework", "methodology", "commands", "agents", "skills", "mcp", "brain", "ide", "readme"]);
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
		const vaultStep = brainSteps.find((s) => s.name === "Brain root directories");
		expect(vaultStep).toBeDefined();
		expect(vaultStep?.status).toBe("would-create");
		expect(vaultStep?.filePath).toBe("");
	});

	it("no brainPath + hints non-empty: vault step has empty-string filePath (hint NOT used as default)", async () => {
		// Create a real vault directory so resolveBrainHints returns a hint via env
		const hintVault = join(tempDir, "hint-vault");
		await mkdir(hintVault);
		process.env.AIDE_BRAIN_PATH = hintVault;

		const isolated = join(tempDir, "project");
		await mkdir(isolated);
		// Call without brainPath — the hint must NOT be baked in
		const result = await init(isolated);

		// Hints should be non-empty (the env hint exists)
		const envHints = result.brainHints.filter((h) => h.source === "env");
		expect(envHints.length).toBeGreaterThan(0);

		// Despite hints being present, vault step must have empty filePath
		const vaultStep = result.steps.find((s) => s.name === "Brain root directories");
		expect(vaultStep).toBeDefined();
		expect(vaultStep?.status).toBe("would-create");
		expect(vaultStep?.filePath).toBe("");

		// Brain MCP step must have NO prescription when brainPath is absent —
		// the entry cannot be derived without a brain.aide, so no prescription is emitted.
		const brainMcpStep = result.steps.find((s) => s.name === "MCP config (brain)");
		expect(brainMcpStep).toBeDefined();
		expect(brainMcpStep?.prescription).toBeUndefined();
	});

	it("no brainPath + hints empty: vault step has empty-string filePath", async () => {
		delete process.env.AIDE_BRAIN_PATH;
		const isolated = join(tempDir, "deeply", "nested", "project");
		await mkdir(isolated, { recursive: true });

		const result = await init(isolated);

		if (result.brainHints.length === 0) {
			const vaultStep = result.steps.find((s) => s.name === "Brain root directories");
			expect(vaultStep).toBeDefined();
			expect(vaultStep?.filePath).toBe("");
			expect(vaultStep?.status).toBe("would-create");
		}
	});

	it("explicit brainPath: vault step has that path, brainHints still returned", async () => {
		const confirmedPath = join(tempDir, "confirmed-vault");
		const result = await init(tempDir, undefined, undefined, confirmedPath);

		// The vault step must use the confirmed path
		const vaultStep = result.steps.find((s) => s.name === "Brain root directories");
		expect(vaultStep).toBeDefined();
		expect(vaultStep?.filePath).toBe(confirmedPath);

		// brainHints still present at top level (agent interview material)
		expect(result).toHaveProperty("brainHints");
		expect(Array.isArray(result.brainHints)).toBe(true);

		// Brain MCP prescription uses the confirmed path
		const brainMcpStep = result.steps.find((s) => s.name === "MCP config (brain)");
		expect(brainMcpStep?.prescription).toBeDefined();
		const lastArg = brainMcpStep?.prescription?.entry.args?.at(-1);
		expect(lastArg).toBe(confirmedPath);
	});

	it("idempotency — re-running on initialized content returns exists steps", async () => {
		// Write the canonical methodology stub (byte-identical to what writeMethodology produces)
		// so the pointer step reports 'exists' rather than 'would-overwrite'.
		const canonicalStub = composeStub(".aide/docs");
		await mkdir(join(tempDir, ".claude"));
		await mkdir(join(tempDir, ".claude", "commands", "aide"), { recursive: true });
		await writeFile(join(tempDir, "CLAUDE.md"), `${canonicalStub}\n`);
		await writeFile(join(tempDir, ".mcp.json"), JSON.stringify({ mcpServers: { aide: expectedAideMcpEntry } }));

		// After writing the canonical stub, pointer should be exists
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

describe("init — apply mode (category call)", () => {
	it("commands category: all command files exist on disk after apply, steps have status created and no content", async () => {
		const result = await init(tempDir);
		const commandSteps = result.steps.filter((s) => s.category === "commands");
		expect(commandSteps.length).toBeGreaterThan(0);

		const applied = await applySteps(commandSteps);

		for (const step of applied) {
			if (step.status === "created") {
				expect(step).not.toHaveProperty("content");
				expect(await pathExists(step.filePath)).toBe(true);
			}
		}
		// At least one step should be created (fresh project has no commands)
		expect(applied.some((s) => s.status === "created")).toBe(true);
	});

	it("brain category with brainPath: vault directories are created, brain step has status created", async () => {
		const brainPath = join(tempDir, "my-vault");
		const result = await init(tempDir, undefined, undefined, brainPath);
		const brainSteps = result.steps.filter((s) => s.category === "brain");
		expect(brainSteps.length).toBeGreaterThan(0);

		const applied = await applySteps(brainSteps);
		const vaultStep = applied.find((s) => s.name === "Brain root directories");

		expect(vaultStep).toBeDefined();
		expect(vaultStep?.status).toBe("created");
		expect(vaultStep).not.toHaveProperty("content");

		// The vault directories should exist on disk
		expect(await pathExists(join(brainPath, "research"))).toBe(true);
		expect(await pathExists(join(brainPath, "coding-playbook"))).toBe(true);
	});

	it("MCP steps in a category call: prescription is preserved in the returned manifest", async () => {
		const result = await init(tempDir);
		const mcpSteps = result.steps.filter((s) => s.category === "mcp" && s.prescription);
		expect(mcpSteps.length).toBeGreaterThan(0);

		const applied = await applySteps(mcpSteps);

		for (const step of applied) {
			if (step.prescription) {
				expect(step.prescription.key).toBeTruthy();
				expect(step.prescription.entry.command).toBeTruthy();
			}
		}
		// MCP steps are never written — no files should exist
		for (const step of applied) {
			// MCP config file should not have been created by applySteps
			expect(step.status).not.toBe("created");
		}
	});

	it("summary call (no category): no files are written, steps have content stripped", async () => {
		const result = await init(tempDir);
		const stripped = result.steps.map(({ content: _content, ...rest }) => rest);

		for (const step of stripped) {
			expect(step).not.toHaveProperty("content");
		}
		// No files should exist in a fresh tempDir after summary call
		const anyFileWritten = await Promise.all(
			stripped
				.filter((s) => s.filePath && s.filePath !== "")
				.map((s) => pathExists(s.filePath)),
		);
		expect(anyFileWritten.every((exists) => !exists)).toBe(true);
	});
});

describe("init — would-overwrite and silent-create invariants", () => {
	it("drifted command file: that step is would-overwrite, all other canonical steps are exists or would-create", async () => {
		// Apply a full init run first to populate all files, then corrupt one command file.
		const brainPath = join(tempDir, "brain");
		const firstRun = await init(tempDir, undefined, undefined, brainPath);
		await applySteps(firstRun.steps.filter((s) => s.category !== "mcp"));

		// Corrupt research.md to simulate hand-editing
		const commandDir = join(tempDir, ".claude", "commands");
		await writeFile(join(commandDir, "aide", "research.md"), "# my custom research\n", "utf-8");

		const result = await init(tempDir, undefined, undefined, brainPath);
		const commandSteps = stepsForCategory(result, "commands");

		const drifted = commandSteps.find((s) => s.name === "aide:research");
		expect(drifted?.status).toBe("would-overwrite");
		expect(drifted?.content).toBeTruthy();

		// Every other command step must be 'exists' (was just applied byte-identical)
		const others = commandSteps.filter((s) => s.name !== "aide:research");
		for (const step of others) {
			expect(step.status, `expected ${step.name} to be exists`).toBe("exists");
		}
	});

	it("fully-initialized project: every canonical-owned step is exists", async () => {
		// Apply all steps (brain included) to get a fully initialized state.
		const brainPath = join(tempDir, "brain");
		const firstRun = await init(tempDir, undefined, undefined, brainPath);
		// Apply all non-MCP steps (MCP is a prescription, not written to disk)
		await applySteps(firstRun.steps.filter((s) => s.category !== "mcp"));

		// Write the canonical MCP config so wireMcp returns exists
		await writeFile(
			join(tempDir, ".mcp.json"),
			JSON.stringify({ mcpServers: { aide: expectedAideMcpEntry } }),
		);

		const result = await init(tempDir, undefined, undefined, brainPath);

		// None of the file-writing categories should have would-create or would-overwrite
		const fileCategories = ["methodology", "commands", "agents", "skills", "brain"] as const;
		for (const category of fileCategories) {
			const steps = stepsForCategory(result, category);
			for (const step of steps) {
				expect(step.status, `${category} / ${step.name} should be exists or would-skip`).toMatch(
					/^(exists|would-skip)$/,
				);
			}
		}

		// No would-create or would-overwrite among canonical-owned categories
		const badStatuses = result.steps
			.filter((s) => fileCategories.includes(s.category as (typeof fileCategories)[number]))
			.filter((s) => s.status === "would-create" || s.status === "would-overwrite");
		expect(badStatuses).toHaveLength(0);
	});

	it("apply mode on drifted category: overwritten status, content stripped, disk bytes match canonical", async () => {
		// Full init + apply to set a clean baseline.
		const brainPath = join(tempDir, "brain");
		const firstRun = await init(tempDir, undefined, undefined, brainPath);
		await applySteps(firstRun.steps.filter((s) => s.category !== "mcp"));

		// Corrupt one command file.
		const commandDir = join(tempDir, ".claude", "commands");
		const driftedPath = join(commandDir, "aide", "spec.md");
		await writeFile(driftedPath, "# my custom spec\n", "utf-8");

		// Plan again — commands category should have one would-overwrite.
		const secondRun = await init(tempDir, undefined, undefined, brainPath);
		const commandSteps = secondRun.steps.filter((s) => s.category === "commands");

		const drifted = commandSteps.find((s) => s.name === "aide:spec");
		expect(drifted?.status).toBe("would-overwrite");
		expect(drifted?.content).toBeTruthy();

		// Apply the commands category.
		const manifest = await applySteps(commandSteps);

		const overwritten = manifest.find((s) => s.name === "aide:spec");
		expect(overwritten?.status).toBe("overwritten");
		expect(overwritten).not.toHaveProperty("content");

		// Disk bytes must now match canonical (re-plan returns exists).
		const thirdRun = await init(tempDir, undefined, undefined, brainPath);
		const afterApply = thirdRun.steps.find((s) => s.name === "aide:spec");
		expect(afterApply?.status).toBe("exists");
	});

	it("drifted versions.json: step is would-overwrite with content populated", async () => {
		// Write a stale/different versions.json to simulate an older canonical manifest on disk.
		const versionsDir = join(tempDir, ".aide");
		await mkdir(versionsDir, { recursive: true });
		await writeFile(join(versionsDir, "versions.json"), JSON.stringify({ stale: true }, null, 2) + "\n", "utf-8");

		const result = await init(tempDir);

		const versionsStep = findStep(result, "versions.json");
		expect(versionsStep).toBeDefined();
		expect(versionsStep?.status).toBe("would-overwrite");
		expect(versionsStep?.content).toBeTruthy();
	});

	it("byte-identical versions.json: step is exists with no content", async () => {
		// Apply a full init to get the byte-identical versions.json on disk.
		const brainPath = join(tempDir, "brain");
		const firstRun = await init(tempDir, undefined, undefined, brainPath);
		await applySteps(firstRun.steps.filter((s) => s.category !== "mcp"));

		const result = await init(tempDir, undefined, undefined, brainPath);

		const versionsStep = findStep(result, "versions.json");
		expect(versionsStep).toBeDefined();
		expect(versionsStep?.status).toBe("exists");
		expect(versionsStep?.content).toBeUndefined();
	});

	it("pure-create run (fresh tempDir, brainPath supplied): no would-overwrite statuses", async () => {
		const brainPath = join(tempDir, "brain");
		const result = await init(tempDir, undefined, undefined, brainPath);

		const overwriteSteps = result.steps.filter((s) => s.status === "would-overwrite");
		expect(overwriteSteps).toHaveLength(0);

		// Every non-exists, non-would-skip, non-MCP step must be would-create
		const fileSteps = result.steps.filter(
			(s) => s.category !== "mcp" && s.status !== "exists" && s.status !== "would-skip",
		);
		for (const step of fileSteps) {
			expect(step.status, `${step.category} / ${step.name} should be would-create on cold start`).toBe("would-create");
		}
	});
});

describe("init — sentinel brain path collision (issue 8)", () => {
	it("my-brain/ inside project root does not appear as brain vault step filePath when no env var set", async () => {
		delete process.env.AIDE_BRAIN_PATH;
		// Use isolated subdir so sibling hint from real cwd doesn't fire
		const isolated = join(tempDir, "project");
		await mkdir(isolated);
		// Create a my-brain/ directory INSIDE the project root
		await mkdir(join(isolated, "my-brain"));

		const result = await init(isolated);

		const vaultStep = result.steps.find((s) => s.name === "Brain root directories");
		expect(vaultStep).toBeDefined();
		// The tool must NOT adopt the inner my-brain/ path silently.
		// With no env var and the project root itself not having a sibling my-brain
		// at the same level, brainHints should be empty (or only contain sibling hint
		// from the parent tempDir level, not the inner one).
		// The vault step must have status would-create (not exists pointing at inner dir).
		// If brainHints is empty, filePath must be "".
		if (result.brainHints.length === 0) {
			expect(vaultStep?.filePath).toBe("");
			expect(vaultStep?.status).toBe("would-create");
		} else {
			// If a hint fired (sibling at parent level), the filePath must NOT be the inner my-brain
			expect(vaultStep?.filePath).not.toBe(join(isolated, "my-brain"));
		}
	});

	it("completely isolated project (no env var, no sibling, subdirectory): brain vault step has empty filePath", async () => {
		delete process.env.AIDE_BRAIN_PATH;
		// Use a deeply nested isolated dir where no sibling my-brain can exist at parent
		const isolated = join(tempDir, "deeply", "nested", "project");
		await mkdir(isolated, { recursive: true });

		const result = await init(isolated);

		const vaultStep = result.steps.find((s) => s.name === "Brain root directories");
		expect(vaultStep).toBeDefined();

		// If no hints, the vault step must have empty filePath (not a fabricated path)
		if (result.brainHints.length === 0) {
			expect(vaultStep?.filePath).toBe("");
			expect(vaultStep?.status).toBe("would-create");
		}
	});
});
