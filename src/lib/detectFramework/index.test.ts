import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import detectFramework from "./index.js";

let tempDir: string;

beforeEach(async () => {
	tempDir = await mkdtemp(join(tmpdir(), "aide-detect-"));
});

afterEach(async () => {
	await rm(tempDir, { recursive: true, force: true });
});

describe("detectFramework", () => {
	it("returns specified framework when override is provided", async () => {
		const result = await detectFramework(tempDir, "cursor");

		expect(result.framework).toBe("cursor");
		expect(result.configPath).toBe(".cursorrules");
	});

	it("detects Claude Code from .claude directory", async () => {
		await mkdir(join(tempDir, ".claude"));

		const result = await detectFramework(tempDir);

		expect(result.framework).toBe("claude");
		expect(result.configPath).toBe("CLAUDE.md");
		expect(result.commandDir).toBe(".claude/commands");
		expect(result.mcpConfigPath).toBe(".mcp.json");
	});

	it("detects Cursor from .cursor directory", async () => {
		await mkdir(join(tempDir, ".cursor"));

		const result = await detectFramework(tempDir);

		expect(result.framework).toBe("cursor");
	});

	it("detects Windsurf from .windsurfrules file", async () => {
		await writeFile(join(tempDir, ".windsurfrules"), "");

		const result = await detectFramework(tempDir);

		expect(result.framework).toBe("windsurf");
		expect(result.commandDir).toBe(".windsurf/commands");
	});

	it("detects Copilot from .github/copilot-instructions.md", async () => {
		await mkdir(join(tempDir, ".github"), { recursive: true });
		await writeFile(join(tempDir, ".github", "copilot-instructions.md"), "");

		const result = await detectFramework(tempDir);

		expect(result.framework).toBe("copilot");
	});

	it("defaults to Claude Code when no framework detected", async () => {
		const result = await detectFramework(tempDir);

		expect(result.framework).toBe("claude");
		expect(result.configPath).toBe("CLAUDE.md");
	});

	it("prefers Claude Code over Cursor when both exist", async () => {
		await mkdir(join(tempDir, ".claude"));
		await mkdir(join(tempDir, ".cursor"));

		const result = await detectFramework(tempDir);

		expect(result.framework).toBe("claude");
	});
});
