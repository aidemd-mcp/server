/**
 * Integration test suite for `runInit` — Step 7 of src/cli/init/plan.aide.
 *
 * Uses real filesystem temp dirs (mkdtemp) so the full pipeline is exercised
 * end-to-end: brain.aide scaffold → MCP entry write → all planning helpers →
 * applySteps → renderWarning → stdout capture.
 *
 * No module-level vi.mock() calls — real dependencies are exercised. This
 * mirrors the pattern established in src/cli/sync/index.test.ts.
 *
 * The vi.hoisted guard suppresses the IIFE's process.exit call that fires when
 * the module is imported in the test environment — the same pattern used in the
 * unit test file (index.test.ts).
 *
 * Tests 7c-vi and 7c-vii exercise the IIFE's forbidden-flag and unknown-brain-value
 * paths. Because the IIFE fires at module import time, each case resets modules
 * and re-imports after setting process.argv.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Intercept process.exit before the module loads so the IIFE's process.exit
// calls are no-ops in the test environment. The handle is returned so tests
// can assert calls and clear between runs.
const { mockExit } = vi.hoisted(() => {
	const mockExit = vi.fn();
	process.exit = mockExit as unknown as typeof process.exit;
	return { mockExit };
});

import { mkdtemp, readFile, writeFile, mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { runInit } from "./index.js";

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

let tempDir: string;

beforeEach(async () => {
	tempDir = await mkdtemp(join(tmpdir(), "aide-init-integration-"));
	// Re-arm process.exit mock so each test starts fresh.
	mockExit.mockClear();
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
// 7c-i. Cold install happy path, default integration
// ---------------------------------------------------------------------------

describe("7c-i — cold install happy path, default integration (no options arg)", () => {
	it("exits 0; brain.aide exists; .mcp.json has only aide key; stdout has correct log lines and brain-wiring deferred entry", async () => {
		const { lines, write } = makeCapture();

		const code = await runInit(tempDir, write);

		expect(code).toBe(0);

		// brain.aide must exist on disk.
		const brainAidePath = join(tempDir, ".aide", "config", "brain.aide");
		await expect(readFile(brainAidePath, "utf-8")).resolves.toBeTruthy();

		// .mcp.json must exist and have only the aide key — NO brain key.
		const mcpPath = join(tempDir, ".mcp.json");
		const mcpRaw = await readFile(mcpPath, "utf-8");
		const mcp = JSON.parse(mcpRaw) as { mcpServers: Record<string, unknown> };
		expect(mcp.mcpServers).toHaveProperty("aide");
		expect(mcp.mcpServers).not.toHaveProperty("brain");

		// The joined output should contain the brain-wiring deferred entry strings.
		const joined = lines.join("\n");
		expect(joined).toContain("Brain wiring — open Claude Code and run /aide;");
		expect(joined).toContain("/aide:brain config");

		// Forbidden substrings must NOT appear in stdout.
		expect(joined).not.toContain("<BRAIN_PATH>");
		expect(joined).not.toContain("--brain-path");
		expect(joined).not.toContain("the orchestrator will detect");

		// brain.aide log line: starts with [created] and contains "bundled brain template".
		const brainLine = lines.find((l) => l.startsWith("[created] .aide/config/brain.aide"));
		expect(brainLine).toBeDefined();
		expect(brainLine).toContain("bundled brain template");
	});
});

// ---------------------------------------------------------------------------
// 7c-ii. Cold install with explicit --brain obsidian
// ---------------------------------------------------------------------------

describe("7c-ii — cold install with explicit { brain: 'obsidian' } produces the same result as the default", () => {
	it("exits 0; on-disk and stdout state byte-equivalent to 7c-i (default)", async () => {
		// Run default (no options) to get reference bytes.
		const refDir = await mkdtemp(join(tmpdir(), "aide-init-ref-"));
		try {
			await runInit(refDir);
			const refBrainAide = await readFile(join(refDir, ".aide", "config", "brain.aide"), "utf-8");
			const refMcp = await readFile(join(refDir, ".mcp.json"), "utf-8");

			// Run explicit --brain obsidian.
			const { lines, write } = makeCapture();
			const code = await runInit(tempDir, write, { brain: "obsidian" });
			expect(code).toBe(0);

			const explicitBrainAide = await readFile(join(tempDir, ".aide", "config", "brain.aide"), "utf-8");
			const explicitMcp = await readFile(join(tempDir, ".mcp.json"), "utf-8");

			// brain.aide bytes must match.
			expect(explicitBrainAide).toBe(refBrainAide);

			// .mcp.json bytes may differ only in key-ordering semantics for the aide entry
			// (both have the same aide config), so parse and compare aide entry content.
			const refMcpParsed = JSON.parse(refMcp) as { mcpServers: Record<string, unknown> };
			const explicitMcpParsed = JSON.parse(explicitMcp) as { mcpServers: Record<string, unknown> };
			expect(JSON.stringify(explicitMcpParsed.mcpServers.aide)).toBe(
				JSON.stringify(refMcpParsed.mcpServers.aide),
			);

			// .mcp.json must not have brain key on either.
			expect(explicitMcpParsed.mcpServers).not.toHaveProperty("brain");

			// brain.aide log line.
			const brainLine = lines.find((l) => l.startsWith("[created] .aide/config/brain.aide"));
			expect(brainLine).toBeDefined();
			expect(brainLine).toContain("bundled brain template");
		} finally {
			await rm(refDir, { recursive: true, force: true });
		}
	});
});

// ---------------------------------------------------------------------------
// 7c-iii. Cold install with pre-existing .mcp.json carrying github + legacy obsidian entry
// ---------------------------------------------------------------------------

describe("7c-iii — cold install with pre-existing .mcp.json carrying github and legacy obsidian entry", () => {
	it("adds aide; leaves github and obsidian byte-identical; brain key absent; someOtherKey survives", async () => {
		// Pre-write .mcp.json with github, obsidian, and a top-level key.
		const preExistingMcp = {
			someOtherKey: "preserve-me",
			mcpServers: {
				github: { command: "npx", args: ["@github/mcp-server"] },
				obsidian: { command: "npx", args: ["@bitbonsai/mcpvault", "/old/vault"] },
			},
		};
		await writeFile(join(tempDir, ".mcp.json"), JSON.stringify(preExistingMcp, null, 2) + "\n", "utf-8");

		await runInit(tempDir);

		const postRaw = await readFile(join(tempDir, ".mcp.json"), "utf-8");
		const post = JSON.parse(postRaw) as {
			someOtherKey: string;
			mcpServers: Record<string, unknown>;
		};

		// aide must have been added.
		expect(post.mcpServers).toHaveProperty("aide");

		// github must be byte-identical.
		expect(JSON.stringify(post.mcpServers.github)).toBe(
			JSON.stringify(preExistingMcp.mcpServers.github),
		);

		// obsidian must still be present and byte-identical (cli/init does not migrate legacy keys).
		expect(post.mcpServers).toHaveProperty("obsidian");
		expect(JSON.stringify(post.mcpServers.obsidian)).toBe(
			JSON.stringify(preExistingMcp.mcpServers.obsidian),
		);

		// brain key must NOT exist.
		expect(post.mcpServers).not.toHaveProperty("brain");

		// someOtherKey must survive.
		expect(post.someOtherKey).toBe("preserve-me");
	});
});

// ---------------------------------------------------------------------------
// 7c-iv. Idempotent re-run
// ---------------------------------------------------------------------------

describe("7c-iv — idempotent re-run: second runInit changes nothing", () => {
	it("second call reports only [exists] lines; mcp.json and brain.aide bytes are unchanged; warning still contains brain-wiring entry", async () => {
		// First run — creates everything.
		await runInit(tempDir, () => {});

		// Snapshot .mcp.json and brain.aide bytes before the second run.
		const mcpBefore = await readFile(join(tempDir, ".mcp.json"), "utf-8");
		const brainAideBefore = await readFile(join(tempDir, ".aide", "config", "brain.aide"), "utf-8");

		// Second run.
		const { lines, write } = makeCapture();
		const code = await runInit(tempDir, write);

		expect(code).toBe(0);

		// Every bracket-prefixed log line must be [exists] — nothing (re)created.
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
		const brainAideAfter = await readFile(join(tempDir, ".aide", "config", "brain.aide"), "utf-8");
		expect(brainAideAfter).toBe(brainAideBefore);

		// Warning still contains the brain-wiring deferred entry on the second run.
		const joined = lines.join("\n");
		expect(joined).toContain("Brain wiring —");
		expect(joined).toContain("/aide:brain config");
	});
});

// ---------------------------------------------------------------------------
// 7c-v. Pre-existing .aide/config/brain.aide on disk (user-owned)
// ---------------------------------------------------------------------------

describe("7c-v — pre-existing .aide/config/brain.aide is never touched", () => {
	it("user-owned brain.aide is byte-identical after runInit regardless of its content", async () => {
		// Pre-write .aide/config/brain.aide with arbitrary user content.
		const brainAidePath = join(tempDir, ".aide", "config", "brain.aide");
		await mkdir(join(tempDir, ".aide", "config"), { recursive: true });
		const userContent = "# user content — do not touch\n";
		await writeFile(brainAidePath, userContent, "utf-8");

		// Run init.
		const { lines, write } = makeCapture();
		await runInit(tempDir, write);

		// brain.aide bytes must be identical to what the user wrote.
		const afterContent = await readFile(brainAidePath, "utf-8");
		expect(afterContent).toBe(userContent);

		// brain.aide log line must show [exists].
		const brainLine = lines.find((l) => l.includes("brain.aide"));
		expect(brainLine).toBeDefined();
		expect(brainLine).toMatch(/^\[exists\] \.aide\/config\/brain\.aide/);
	});
});

// ---------------------------------------------------------------------------
// 7c-vi. Forbidden flag fails fast (per flag)
// ---------------------------------------------------------------------------

describe("7c-vi — forbidden flags cause process.exit(1) before any file is written", () => {
	const forbiddenFlags = [
		"--brain-path",
		"--vault-path",
		"--brain-root",
		"--brain-token",
		"--brain-url",
		"--brain-name",
	] as const;

	// Each flag is tested in isolation: set process.argv, reset modules, import.
	it.each(forbiddenFlags)("flag %s: exits 1, stderr names the flag and /aide:brain config, no files written", async (flag) => {
		// Capture stderr output.
		const stderrChunks: string[] = [];
		const originalStderrWrite = process.stderr.write.bind(process.stderr);
		process.stderr.write = ((chunk: string | Uint8Array) => {
			stderrChunks.push(String(chunk));
			return true;
		}) as unknown as typeof process.stderr.write;

		// Override process.argv so the IIFE sees the forbidden flag.
		const originalArgv = process.argv;
		process.argv = ["node", "index.js", flag, "/some/path"];

		try {
			// Reset module registry and re-import so the IIFE fires with the new argv.
			vi.resetModules();
			await import("./index.js");

			const stderrJoined = stderrChunks.join("");

			// process.exit must have been called with 1.
			expect(process.exit).toHaveBeenCalledWith(1);

			// stderr must name the offending flag verbatim.
			expect(stderrJoined).toContain(flag);

			// stderr must route the user to /aide:brain config.
			expect(stderrJoined).toContain("/aide:brain config");

			// No files should have been written to tempDir (the IIFE uses process.cwd()
			// and exits before runInit is called, so nothing lands on disk under tempDir).
			// Verify the aide config directory was NOT created under tempDir.
			await expect(
				readFile(join(tempDir, ".mcp.json"), "utf-8"),
			).rejects.toThrow();
			await expect(
				readFile(join(tempDir, ".aide", "config", "brain.aide"), "utf-8"),
			).rejects.toThrow();
		} finally {
			process.argv = originalArgv;
			process.stderr.write = originalStderrWrite;
			// Re-arm the exit mock for subsequent tests.
			mockExit.mockClear();
			vi.resetModules();
		}
	});
});

// ---------------------------------------------------------------------------
// 7c-vii. Unknown --brain value fails fast
// ---------------------------------------------------------------------------

describe("7c-vii — unknown --brain value causes process.exit(1) before any file is written", () => {
	it("--brain mem0 exits 1, stderr contains 'mem0' and the registered name list, no file written", async () => {
		const stderrChunks: string[] = [];
		const originalStderrWrite = process.stderr.write.bind(process.stderr);
		process.stderr.write = ((chunk: string | Uint8Array) => {
			stderrChunks.push(String(chunk));
			return true;
		}) as unknown as typeof process.stderr.write;

		const originalArgv = process.argv;
		process.argv = ["node", "index.js", "--brain", "mem0"];

		try {
			vi.resetModules();
			await import("./index.js");

			const stderrJoined = stderrChunks.join("");

			// process.exit must have been called with 1.
			expect(process.exit).toHaveBeenCalledWith(1);

			// stderr must contain the unknown value.
			expect(stderrJoined).toContain("mem0");

			// stderr must contain the registered integrations list (at minimum "obsidian").
			expect(stderrJoined).toContain("obsidian");

			// No files written.
			await expect(readFile(join(tempDir, ".mcp.json"), "utf-8")).rejects.toThrow();
			await expect(readFile(join(tempDir, ".aide", "config", "brain.aide"), "utf-8")).rejects.toThrow();
		} finally {
			process.argv = originalArgv;
			process.stderr.write = originalStderrWrite;
			mockExit.mockClear();
			vi.resetModules();
		}
	});
});
