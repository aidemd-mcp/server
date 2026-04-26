/**
 * Integration test suite for `runInit` — Step 5 of src/cli/init/plan.aide.
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
import { mkdtemp, mkdir, readFile, rm } from "node:fs/promises";
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
// 5a. brain.aide scaffold + parseBrainAide round-trip
// ---------------------------------------------------------------------------

describe("5a — .aide/brain.aide is scaffolded with canonical Obsidian content", () => {
	it("file exists on disk after runInit and parseBrainAide returns ok with the expected rootPath", async () => {
		const vaultPath = tmpdir();
		const { write } = makeCapture();

		await runInit(tempDir, write, { vaultPath });

		// Verify the file is on disk.
		const brainAidePath = join(tempDir, ".aide", "brain.aide");
		const diskContent = await readFile(brainAidePath, "utf-8");
		expect(diskContent).toBeTruthy();

		// Parse via parseBrainAide — must return ok.
		const result = await parseBrainAide(tempDir);
		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return; // narrow

		// The parsed config should match what the template produces.
		const templateContent = obsidianBrainAideTemplate(vaultPath);
		const templateResult = await parseBrainAide(tempDir); // already on disk
		expect(templateResult.kind).toBe("ok");
		if (templateResult.kind !== "ok") return;

		expect(result.config.connector).toBe("obsidian");
		expect(result.config.rootPath).toBe(vaultPath);
		expect(result.config.entryFile).toBe("CLAUDE.md");
		expect(result.config.tools.read).toBe("mcp__brain__read_note");
		expect(result.config.tools.search).toBe("mcp__brain__search_notes");

		// The disk content must be byte-identical to the template.
		expect(diskContent).toBe(templateContent);
	});
});

// ---------------------------------------------------------------------------
// 5b. .mcp.json has aide + brain entries, no uninterpolated ${rootPath}
// ---------------------------------------------------------------------------

describe("5b — .mcp.json contains mcpServers.aide and mcpServers.brain with vaultPath substituted", () => {
	it("writes both server entries and replaces all ${rootPath} placeholders", async () => {
		const vaultPath = tmpdir();
		const { write } = makeCapture();

		await runInit(tempDir, write, { vaultPath });

		const mcpPath = join(tempDir, ".mcp.json");
		const raw = await readFile(mcpPath, "utf-8");
		const mcp = JSON.parse(raw) as {
			mcpServers: Record<string, { command: string; args: string[] }>;
		};

		// Both managed entries must be present.
		expect(mcp.mcpServers).toHaveProperty("aide");
		expect(mcp.mcpServers).toHaveProperty("brain");

		// The brain entry must have the vaultPath fully substituted — no literal
		// ${rootPath} placeholder may remain in any arg.
		const brainEntry = mcp.mcpServers["brain"];
		expect(brainEntry).toBeDefined();
		const hasUninterpolated = brainEntry.args.some((a) => a.includes("${rootPath}"));
		expect(hasUninterpolated).toBe(false);

		// The vaultPath value itself must appear in the brain args.
		const hasVaultPath = brainEntry.args.some((a) => a === vaultPath);
		expect(hasVaultPath).toBe(true);

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
// 5c. Captured stdout includes brain.aide line + MCP line; warning has only IDE
// ---------------------------------------------------------------------------

describe("5c — stdout includes brain.aide and MCP log lines; warning contains only IDE deferred entry", () => {
	it("emits [created] brain.aide and [created] .mcp.json lines; warning block lists only IDE", async () => {
		const vaultPath = tmpdir();
		const { lines, write } = makeCapture();

		await runInit(tempDir, write, { vaultPath });

		const joined = lines.join("\n");

		// brain.aide log line must be present.
		const brainLine = lines.find((l) => l.includes("brain.aide"));
		expect(brainLine).toBeDefined();
		expect(brainLine).toMatch(/^\[created\] \.aide\/brain\.aide/);

		// .mcp.json log line must be present.
		const mcpLine = lines.find((l) => l.includes(".mcp.json"));
		expect(mcpLine).toBeDefined();

		// brain.aide line must appear before the .mcp.json line.
		expect(lines.indexOf(brainLine!)).toBeLessThan(lines.indexOf(mcpLine!));

		// The warning block must not contain the brain-config or brain-MCP deferred strings.
		expect(joined).not.toContain("Brain config (.aide/brain.aide)");
		expect(joined).not.toContain("Brain MCP entry");

		// The warning block must contain only the IDE deferred entry (from renderWarning).
		// With vaultPath supplied, only IDE is deferred.
		expect(joined).toContain("IDE configuration");
	});
});

// ---------------------------------------------------------------------------
// 5d. Full idempotency end-to-end — second runInit reports every step as exists
// ---------------------------------------------------------------------------

describe("5d — second runInit against the same dir reports every step as exists and writes nothing", () => {
	it("second call logs only [exists] lines and no [created] lines", async () => {
		const vaultPath = tmpdir();

		// First run — creates everything.
		await runInit(tempDir, () => {}, { vaultPath });

		// Snapshot .mcp.json bytes before second run.
		const mcpBefore = await readFile(join(tempDir, ".mcp.json"), "utf-8");

		// Second run against the same directory.
		const { lines, write } = makeCapture();
		const code = await runInit(tempDir, write, { vaultPath });

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

		// brain.aide bytes must be unchanged.
		const brainBefore = obsidianBrainAideTemplate(vaultPath);
		const brainAfter = await readFile(join(tempDir, ".aide", "brain.aide"), "utf-8");
		expect(brainAfter).toBe(brainBefore);
	});
});
