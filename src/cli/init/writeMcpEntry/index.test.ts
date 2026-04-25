import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import writeMcpEntry from "./index.js";
import { mcpEntry } from "@/service/install/wireMcp/index.js";
import { obsidianMcpEntry } from "@/service/install/provisionBrain/index.js";

let tempDir: string;

beforeEach(async () => {
	tempDir = await mkdtemp(join(tmpdir(), "aide-writemcp-"));
});

afterEach(async () => {
	await rm(tempDir, { recursive: true, force: true });
});

describe("writeMcpEntry", () => {
	// --- cold install (no obsidian key, no brain key) ---

	it("creates valid JSON with mcpServers.aide entry when no .mcp.json exists", async () => {
		const result = await writeMcpEntry(tempDir);

		expect(result.status).toBe("created");

		const written = await readFile(join(tempDir, ".mcp.json"), "utf-8");
		const parsed = JSON.parse(written);

		expect(parsed.mcpServers).toBeDefined();
		expect(parsed.mcpServers.aide).toEqual(mcpEntry());
	});

	it("cold install: writes brain key (not obsidian) when no .mcp.json exists", async () => {
		await writeMcpEntry(tempDir, "/my/vault");

		const written = await readFile(join(tempDir, ".mcp.json"), "utf-8");
		const parsed = JSON.parse(written);

		expect(parsed.mcpServers.brain).toEqual(obsidianMcpEntry("/my/vault"));
		expect(parsed.mcpServers.obsidian).toBeUndefined();
	});

	it("uses the platform-appropriate npx entry shape for aide", async () => {
		await writeMcpEntry(tempDir);

		const written = await readFile(join(tempDir, ".mcp.json"), "utf-8");
		const parsed = JSON.parse(written);

		expect(parsed.mcpServers.aide).toEqual(mcpEntry());
	});

	// --- legacy obsidian-only install ---

	it("legacy: writes brain key when only obsidian key is present", async () => {
		const existing = {
			mcpServers: {
				obsidian: { command: "npx", args: ["@bitbonsai/mcpvault", "/old/vault"] },
			},
		};
		await writeFile(
			join(tempDir, ".mcp.json"),
			JSON.stringify(existing, null, 2),
			"utf-8",
		);

		const result = await writeMcpEntry(tempDir, "/my/vault");

		expect(result.status).toBe("created");

		const written = await readFile(join(tempDir, ".mcp.json"), "utf-8");
		const parsed = JSON.parse(written);

		expect(parsed.mcpServers.brain).toEqual(obsidianMcpEntry("/my/vault"));
		// Obsidian orphan key is preserved — cleanup is deferred to a separate step.
		expect(parsed.mcpServers.obsidian).toEqual(existing.mcpServers.obsidian);
		expect(parsed.mcpServers.aide).toEqual(mcpEntry());
	});

	it("legacy: preserves obsidian orphan key (no delete)", async () => {
		const obsidianEntry = { command: "npx", args: ["@bitbonsai/mcpvault", "/old/vault"] };
		const existing = {
			mcpServers: {
				obsidian: obsidianEntry,
			},
		};
		await writeFile(
			join(tempDir, ".mcp.json"),
			JSON.stringify(existing, null, 2),
			"utf-8",
		);

		await writeMcpEntry(tempDir);

		const written = await readFile(join(tempDir, ".mcp.json"), "utf-8");
		const parsed = JSON.parse(written);

		expect(parsed.mcpServers.obsidian).toEqual(obsidianEntry);
	});

	// --- transitional (both obsidian and brain exist) ---

	it("transitional: leaves brain alone when both obsidian and brain keys are present, adds aide", async () => {
		const existingBrainEntry = obsidianMcpEntry("/my/vault");
		const existing = {
			mcpServers: {
				obsidian: { command: "npx", args: ["@bitbonsai/mcpvault", "/old/vault"] },
				brain: existingBrainEntry,
			},
		};
		await writeFile(
			join(tempDir, ".mcp.json"),
			JSON.stringify(existing, null, 2),
			"utf-8",
		);

		const result = await writeMcpEntry(tempDir);

		expect(result.status).toBe("created");

		const written = await readFile(join(tempDir, ".mcp.json"), "utf-8");
		const parsed = JSON.parse(written);

		// Brain key untouched.
		expect(parsed.mcpServers.brain).toEqual(existingBrainEntry);
		// Aide added.
		expect(parsed.mcpServers.aide).toEqual(mcpEntry());
	});

	it("transitional: returns exists when aide, obsidian, and brain are all present", async () => {
		const existing = {
			mcpServers: {
				aide: mcpEntry(),
				obsidian: { command: "npx", args: ["@bitbonsai/mcpvault", "/old/vault"] },
				brain: obsidianMcpEntry("/my/vault"),
			},
		};
		const originalJson = JSON.stringify(existing, null, 2);
		await writeFile(join(tempDir, ".mcp.json"), originalJson, "utf-8");

		const result = await writeMcpEntry(tempDir);

		expect(result.status).toBe("exists");

		const after = await readFile(join(tempDir, ".mcp.json"), "utf-8");
		expect(after).toBe(originalJson);
	});

	// --- already-current (brain exists, no obsidian) ---

	it("already-current: returns exists and does not modify the file when both aide and brain keys are present", async () => {
		const existing = {
			mcpServers: {
				aide: mcpEntry(),
				brain: obsidianMcpEntry("/my/vault"),
			},
		};
		const originalJson = JSON.stringify(existing, null, 2);
		await writeFile(join(tempDir, ".mcp.json"), originalJson, "utf-8");

		const result = await writeMcpEntry(tempDir);

		expect(result.status).toBe("exists");

		const after = await readFile(join(tempDir, ".mcp.json"), "utf-8");
		expect(after).toBe(originalJson);
	});

	it("already-current: returns exists when legacy aidemd-mcp key and brain are both present", async () => {
		const existing = {
			mcpServers: {
				"aidemd-mcp": { command: "npx", args: ["@aidemd-mcp/server"] },
				brain: obsidianMcpEntry("/my/vault"),
			},
		};
		const originalJson = JSON.stringify(existing, null, 2);
		await writeFile(join(tempDir, ".mcp.json"), originalJson, "utf-8");

		const result = await writeMcpEntry(tempDir);

		expect(result.status).toBe("exists");

		const after = await readFile(join(tempDir, ".mcp.json"), "utf-8");
		expect(after).toBe(originalJson);
	});

	// --- error handling ---

	it("throws an error with the spec-documented message when .mcp.json contains malformed JSON", async () => {
		await writeFile(join(tempDir, ".mcp.json"), "{ not valid json {{{{", "utf-8");

		await expect(writeMcpEntry(tempDir)).rejects.toThrow(
			".mcp.json exists but contains invalid JSON. Fix the syntax error and re-run.",
		);
	});

	// --- preservation ---

	it("preserves existing server entries and adds aide and brain when merging", async () => {
		const existing = {
			mcpServers: {
				github: { command: "npx", args: ["@modelcontextprotocol/github"] },
			},
		};
		await writeFile(
			join(tempDir, ".mcp.json"),
			JSON.stringify(existing, null, 2),
			"utf-8",
		);

		const result = await writeMcpEntry(tempDir);

		expect(result.status).toBe("created");

		const written = await readFile(join(tempDir, ".mcp.json"), "utf-8");
		const parsed = JSON.parse(written);

		expect(parsed.mcpServers.github).toEqual(existing.mcpServers.github);
		expect(parsed.mcpServers.aide).toEqual(mcpEntry());
		expect(parsed.mcpServers.brain).toBeDefined();
	});

	it("created message includes existing non-managed server count when merging", async () => {
		const existing = {
			mcpServers: {
				github: { command: "npx", args: ["@modelcontextprotocol/github"] },
				slack: { command: "npx", args: ["@modelcontextprotocol/slack"] },
			},
		};
		await writeFile(
			join(tempDir, ".mcp.json"),
			JSON.stringify(existing, null, 2),
			"utf-8",
		);

		const result = await writeMcpEntry(tempDir);

		expect(result.status).toBe("created");
		expect(result.message).toContain("2 existing servers");
	});

	it("created message uses singular when merging with one non-managed existing server", async () => {
		const existing = {
			mcpServers: {
				github: { command: "npx", args: ["@modelcontextprotocol/github"] },
			},
		};
		await writeFile(
			join(tempDir, ".mcp.json"),
			JSON.stringify(existing, null, 2),
			"utf-8",
		);

		const result = await writeMcpEntry(tempDir);

		expect(result.message).toContain("1 existing server");
		expect(result.message).not.toContain("servers");
	});

	it("writes JSON with 2-space indent and trailing newline", async () => {
		await writeMcpEntry(tempDir);

		const written = await readFile(join(tempDir, ".mcp.json"), "utf-8");

		expect(written).toMatch(/^\{/);
		expect(written.endsWith("\n")).toBe(true);
		// Verify 2-space indentation
		expect(written).toContain('  "mcpServers"');
	});

	it("preserves top-level keys outside mcpServers when merging", async () => {
		const existing = {
			someOtherKey: "preserve-me",
			mcpServers: {
				other: { command: "node", args: ["other.js"] },
			},
		};
		await writeFile(
			join(tempDir, ".mcp.json"),
			JSON.stringify(existing, null, 2),
			"utf-8",
		);

		await writeMcpEntry(tempDir);

		const written = await readFile(join(tempDir, ".mcp.json"), "utf-8");
		const parsed = JSON.parse(written);

		expect(parsed.someOtherKey).toBe("preserve-me");
	});

	it("cold install: message includes vault placeholder warning when no vaultPath provided", async () => {
		const result = await writeMcpEntry(tempDir);

		expect(result.message).toContain("brain vault path is a placeholder");
	});

	it("cold install: message does not include vault placeholder warning when vaultPath provided", async () => {
		const result = await writeMcpEntry(tempDir, "/my/vault");

		expect(result.message).not.toContain("placeholder");
	});
});
