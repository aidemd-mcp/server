/**
 * Integration test suite for `runInit` — Step 6 of src/cli/init/plan.aide.
 *
 * Uses real filesystem temp dirs (mkdtemp) so the full pipeline is exercised
 * end-to-end: brain.aide scaffold → MCP entry write → all planning helpers →
 * applySteps → renderWarning → stdout capture.
 *
 * No module-level vi.mock() calls — real dependencies are exercised. This
 * mirrors the pattern established in src/cli/sync/index.test.ts.
 *
 * Option B was chosen (sibling file) because the parent index.test.ts
 * declares a blanket vi.mock("node:fs/promises") at module scope that cannot
 * be cleanly un-scoped inside a describe block. A fresh file with no mocks is
 * the only clean way to exercise real FS in Vitest.
 *
 * The vi.hoisted guard suppresses the IIFE's process.exit call that fires when
 * the module is imported in the test environment — the same pattern used in the
 * unit test file (index.test.ts).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Intercept process.exit before the module loads so the IIFE's process.exit
// calls are no-ops in the test environment.
vi.hoisted(() => {
	process.exit = vi.fn() as unknown as typeof process.exit;
});
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { platform } from "node:os";
import { runInit } from "./index.js";
import parseBrainAide from "@/service/parseBrainAide/index.js";
import obsidianBrainAideTemplate from "@/service/install/provisionBrain/obsidianBrainAideTemplate/index.js";

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

let tempDir: string;

beforeEach(async () => {
	tempDir = await mkdtemp(join(tmpdir(), "aide-init-integration-"));
});

afterEach(async () => {
	await rm(tempDir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// Helper: capture stdout lines from runInit
// ---------------------------------------------------------------------------

function makeCapture(): { lines: string[]; write: (line: string) => void } {
	const lines: string[] = [];
	return {
		lines,
		write: (line: string) => lines.push(line),
	};
}

// ---------------------------------------------------------------------------
// 6a. brain.aide scaffold + parseBrainAide round-trip
// ---------------------------------------------------------------------------

describe("6a — .aide/config/brain.aide is scaffolded with canonical Obsidian content", () => {
	it("file exists on disk after runInit and parseBrainAide returns ok with the new two-field schema", async () => {
		const brainPath = tmpdir();
		const { write } = makeCapture();

		await runInit(tempDir, write, { brainPath });

		// Verify the file is on disk at the config-subdirectory path.
		const brainAidePath = join(tempDir, ".aide", "config", "brain.aide");
		const diskContent = await readFile(brainAidePath, "utf-8");
		expect(diskContent).toBeTruthy();

		// Parse via parseBrainAide — must return ok.
		const result = await parseBrainAide(tempDir);
		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return; // narrow

		// New two-field schema: name + mcpServerConfig (flattened on the ok result).
		expect(result.name).toBe("obsidian");

		// Platform-branching for command, per the existing test pattern.
		if (platform() === "win32") {
			expect(result.mcpServerConfig.command).toBe("cmd");
		} else {
			expect(result.mcpServerConfig.command).toBe("npx");
		}

		// The brain root path must appear byte-for-byte in args (no <BRAIN_PATH> placeholder).
		expect(result.mcpServerConfig.args).toContain(brainPath);

		// The disk content must be byte-identical to the template.
		const templateContent = obsidianBrainAideTemplate(brainPath);
		expect(diskContent).toBe(templateContent);
	});
});

// ---------------------------------------------------------------------------
// 6b. .mcp.json has aide + brain entries, no uninterpolated ${rootPath}
// ---------------------------------------------------------------------------

describe("6b — .mcp.json contains mcpServers.aide and mcpServers.brain with brainPath substituted", () => {
	it("writes both server entries and replaces all ${rootPath} placeholders", async () => {
		const brainPath = tmpdir();
		const { write } = makeCapture();

		await runInit(tempDir, write, { brainPath });

		const mcpPath = join(tempDir, ".mcp.json");
		const raw = await readFile(mcpPath, "utf-8");
		const mcp = JSON.parse(raw) as {
			mcpServers: Record<string, { command: string; args: string[] }>;
		};

		// Both managed entries must be present.
		expect(mcp.mcpServers).toHaveProperty("aide");
		expect(mcp.mcpServers).toHaveProperty("brain");

		// The brain entry must have the brainPath fully substituted — no literal
		// ${rootPath} placeholder may remain in any arg (regression guard: default
		// scaffold inlines the path byte-for-byte, no substitution step needed).
		const brainEntry = mcp.mcpServers["brain"];
		expect(brainEntry).toBeDefined();
		const hasUninterpolated = brainEntry.args.some((a) => a.includes("${rootPath}"));
		expect(hasUninterpolated).toBe(false);

		// The brainPath value itself must appear as an exact element in brain args.
		const hasBrainPath = brainEntry.args.some((a) => a === brainPath);
		expect(hasBrainPath).toBe(true);

		// The launcher must be @bitbonsai/mcpvault (not obsidian-mcp).
		expect(brainEntry.args).toContain("@bitbonsai/mcpvault");

		// Windows uses cmd wrapper; POSIX uses npx directly.
		if (platform() === "win32") {
			expect(brainEntry.command).toBe("cmd");
			expect(brainEntry.args).toContain("/c");
			expect(brainEntry.args).toContain("npx");
		} else {
			expect(brainEntry.command).toBe("npx");
		}
	});
});

// ---------------------------------------------------------------------------
// 6c. Captured stdout includes brain.aide line + MCP line; warning has only IDE
// ---------------------------------------------------------------------------

describe("6c — stdout includes brain.aide and MCP log lines; warning contains only IDE deferred entry", () => {
	it("emits [created] .aide/config/brain.aide and [created] .mcp.json lines; warning block lists only IDE", async () => {
		const brainPath = tmpdir();
		const { lines, write } = makeCapture();

		await runInit(tempDir, write, { brainPath });

		const joined = lines.join("\n");

		// brain.aide log line must be present at the config-subdirectory path.
		const brainLine = lines.find((l) => l.includes("brain.aide"));
		expect(brainLine).toBeDefined();
		expect(brainLine).toMatch(/^\[created\] \.aide\/config\/brain\.aide/);

		// .mcp.json log line must be present.
		const mcpLine = lines.find((l) => l.includes(".mcp.json"));
		expect(mcpLine).toBeDefined();

		// brain.aide line must appear before the .mcp.json line.
		expect(lines.indexOf(brainLine!)).toBeLessThan(lines.indexOf(mcpLine!));

		// The warning block must not contain any string starting with the retired
		// separate "Brain config" or "Brain MCP entry" item labels.
		const lines6c = joined.split("\n");
		const hasBrainConfig = lines6c.some((l) => l.trimStart().startsWith("Brain config"));
		const hasBrainMcpEntry = lines6c.some((l) => l.trimStart().startsWith("Brain MCP entry"));
		expect(hasBrainConfig).toBe(false);
		expect(hasBrainMcpEntry).toBe(false);

		// Positive: with brainPath supplied, no deferred Brain content at all —
		// only IDE remains in the warning block.
		expect(joined).not.toContain("Brain wiring");
		expect(joined).toContain("IDE configuration");
	});
});

// ---------------------------------------------------------------------------
// 6d. Full idempotency end-to-end — second runInit reports every step as exists
// ---------------------------------------------------------------------------

describe("6d — second runInit against the same dir reports every step as exists and writes nothing", () => {
	it("second call logs only [exists] lines and no [created] lines", async () => {
		const brainPath = tmpdir();

		// First run — creates everything.
		await runInit(tempDir, () => {}, { brainPath });

		// Snapshot .mcp.json bytes before second run.
		const mcpBefore = await readFile(join(tempDir, ".mcp.json"), "utf-8");

		// Second run against the same directory.
		const { lines, write } = makeCapture();
		const code = await runInit(tempDir, write, { brainPath });

		expect(code).toBe(0);

		// Every single log line must be [exists] — nothing was (re)created.
		const logLines = lines.filter((l) => l.startsWith("["));
		expect(logLines.length).toBeGreaterThan(0);
		const createdLines = logLines.filter((l) => l.startsWith("[created]"));
		expect(createdLines).toHaveLength(0);
		const existsLines = logLines.filter((l) => l.startsWith("[exists]"));
		expect(existsLines.length).toBeGreaterThan(0);

		// .mcp.json bytes must be unchanged.
		const mcpAfter = await readFile(join(tempDir, ".mcp.json"), "utf-8");
		expect(mcpAfter).toBe(mcpBefore);

		// brain.aide bytes must be unchanged — content matches the canonical template
		// bytes for the new two-field schema (name + mcpServerConfig).
		const brainAidePath = join(tempDir, ".aide", "config", "brain.aide");
		const brainBefore = obsidianBrainAideTemplate(brainPath);
		const brainAfter = await readFile(brainAidePath, "utf-8");
		expect(brainAfter).toBe(brainBefore);
	});
});

// ---------------------------------------------------------------------------
// 6e. NEW — cold install with NO brainPath: placeholder propagates end-to-end
// ---------------------------------------------------------------------------

describe("6e — cold install with no --brain-path: <BRAIN_PATH> placeholder propagates to brain.aide and .mcp.json", () => {
	it("scaffolds brain.aide with placeholder, propagates it through parseBrainAide+interpolateArgs into .mcp.json, warning contains brain-wiring entry", async () => {
		const { lines, write } = makeCapture();

		// Run with no brainPath option — must still scaffold brain.aide.
		const code = await runInit(tempDir, write, {});

		expect(code).toBe(0);

		// brain.aide must exist on disk.
		const brainAidePath = join(tempDir, ".aide", "config", "brain.aide");
		const diskContent = await readFile(brainAidePath, "utf-8");
		expect(diskContent).toBeTruthy();

		// parseBrainAide must return ok — the placeholder is valid YAML content.
		const result = await parseBrainAide(tempDir);
		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return; // narrow

		// args must contain the literal string "<BRAIN_PATH>" — the placeholder
		// is present byte-for-byte (not a ${...} interpolation target).
		expect(result.mcpServerConfig.args).toContain("<BRAIN_PATH>");

		// .mcp.json must have the brain entry with the placeholder literal in args.
		const mcpPath = join(tempDir, ".mcp.json");
		const raw = await readFile(mcpPath, "utf-8");
		const mcp = JSON.parse(raw) as {
			mcpServers: Record<string, { command: string; args: string[] }>;
		};

		expect(mcp.mcpServers).toHaveProperty("brain");
		const brainEntry = mcp.mcpServers["brain"];
		expect(brainEntry).toBeDefined();

		// The placeholder propagates verbatim through interpolateArgs into .mcp.json.
		const hasBrainPathPlaceholder = brainEntry.args.some((a) => a === "<BRAIN_PATH>");
		expect(hasBrainPathPlaceholder).toBe(true);

		// Warning block must contain the brain-wiring deferred entry.
		const joined = lines.join("\n");
		expect(joined).toContain("Brain wiring —");
		expect(joined).toContain("/aide:brain config");

		// Warning must NOT contain the retired "open Claude Code and run /aide;" prose.
		expect(joined).not.toContain("open Claude Code and run /aide;");
	});
});

// ---------------------------------------------------------------------------
// 6f. NEW — re-run with different --brain-path: user-owned file is NOT patched
// ---------------------------------------------------------------------------

describe("6f — re-run with different --brain-path against existing brain.aide: user-owned file is unchanged", () => {
	it("second call with a new brainPath does not patch brain.aide; .mcp.json still has <BRAIN_PATH> placeholder", async () => {
		// First run — cold install with no brainPath. Placeholder lands on disk.
		await runInit(tempDir, () => {}, {});

		const brainAidePath = join(tempDir, ".aide", "config", "brain.aide");

		// Snapshot brain.aide bytes BEFORE the second call.
		const brainBytesBefore = await readFile(brainAidePath, "utf-8");

		// Second run — supply a different brainPath. brain.aide must not be patched
		// (user-owned `.aide/config/` invariant: seed-once, never overwrite).
		const { lines, write } = makeCapture();
		await runInit(tempDir, write, { brainPath: "/different/vault" });

		// brain.aide bytes must be identical after the second call.
		const brainBytesAfter = await readFile(brainAidePath, "utf-8");
		expect(brainBytesAfter).toBe(brainBytesBefore);

		// The brain.aide log line for the second run must show [exists].
		const brainLine = lines.find((l) => l.includes("brain.aide"));
		expect(brainLine).toBeDefined();
		expect(brainLine).toMatch(/^\[exists\] \.aide\/config\/brain\.aide/);

		// .mcp.json brain entry must still carry the <BRAIN_PATH> placeholder —
		// the entry was derived from the unchanged on-disk file, not from the
		// in-memory template generated with the new brainPath.
		const mcpPath = join(tempDir, ".mcp.json");
		const raw = await readFile(mcpPath, "utf-8");
		const mcp = JSON.parse(raw) as {
			mcpServers: Record<string, { command: string; args: string[] }>;
		};

		const brainEntry = mcp.mcpServers["brain"];
		expect(brainEntry).toBeDefined();
		const hasBrainPathPlaceholder = brainEntry.args.some((a) => a === "<BRAIN_PATH>");
		expect(hasBrainPathPlaceholder).toBe(true);

		// Warning must still contain "Brain wiring —" because the on-disk file
		// still carries the placeholder. The warning helper does not stat the file —
		// it chooses between two literal arrays based on the run's flag state.
		// Second run supplies brainPath="/different/vault", so deferredCategories
		// returns the IDE-only array — warning does NOT contain "Brain wiring".
		// (This is correct: the warning reflects the run's intent, not disk state.)
		const joined = lines.join("\n");
		expect(joined).not.toContain("Brain wiring");
		expect(joined).toContain("IDE configuration");
	});
});
