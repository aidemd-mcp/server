import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import writeMcpEntry from "./index.js";
import { mcpEntry } from "@/tools/init/wireMcp/index.js";

let tempDir: string;

beforeEach(async () => {
	tempDir = await mkdtemp(join(tmpdir(), "aide-writemcp-"));
});

afterEach(async () => {
	await rm(tempDir, { recursive: true, force: true });
});

describe("writeMcpEntry", () => {
	it("creates valid JSON with mcpServers.aide entry when no .mcp.json exists", async () => {
		const result = await writeMcpEntry(tempDir);

		expect(result.status).toBe("created");

		const written = await readFile(join(tempDir, ".mcp.json"), "utf-8");
		const parsed = JSON.parse(written);

		expect(parsed.mcpServers).toBeDefined();
		expect(parsed.mcpServers.aide).toEqual(mcpEntry());
	});

	it("uses the cmd /c npx entry shape", async () => {
		await writeMcpEntry(tempDir);

		const written = await readFile(join(tempDir, ".mcp.json"), "utf-8");
		const parsed = JSON.parse(written);

		expect(parsed.mcpServers.aide).toEqual({
			command: "cmd",
			args: ["/c", "npx", "@aidemd-mcp/server"],
		});
	});

	it("preserves existing server entries and adds only aide when merging", async () => {
		const existing = {
			mcpServers: {
				obsidian: { command: "npx", args: ["@modelcontextprotocol/obsidian"] },
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

		expect(parsed.mcpServers.obsidian).toEqual(existing.mcpServers.obsidian);
		expect(parsed.mcpServers.github).toEqual(existing.mcpServers.github);
		expect(parsed.mcpServers.aide).toEqual(mcpEntry());
	});

	it("returns exists and does not modify the file when aide key is already present", async () => {
		const existing = {
			mcpServers: {
				aide: { command: "npx", args: ["@aidemd-mcp/server"] },
			},
		};
		const originalJson = JSON.stringify(existing, null, 2);
		await writeFile(join(tempDir, ".mcp.json"), originalJson, "utf-8");

		const result = await writeMcpEntry(tempDir);

		expect(result.status).toBe("exists");

		const after = await readFile(join(tempDir, ".mcp.json"), "utf-8");
		expect(after).toBe(originalJson);
	});

	it("returns exists when legacy aidemd-mcp key is present (dual-key check)", async () => {
		const existing = {
			mcpServers: {
				"aidemd-mcp": { command: "npx", args: ["@aidemd-mcp/server"] },
			},
		};
		const originalJson = JSON.stringify(existing, null, 2);
		await writeFile(join(tempDir, ".mcp.json"), originalJson, "utf-8");

		const result = await writeMcpEntry(tempDir);

		expect(result.status).toBe("exists");

		const after = await readFile(join(tempDir, ".mcp.json"), "utf-8");
		expect(after).toBe(originalJson);
	});

	it("throws an error with the spec-documented message when .mcp.json contains malformed JSON", async () => {
		await writeFile(join(tempDir, ".mcp.json"), "{ not valid json {{{{", "utf-8");

		await expect(writeMcpEntry(tempDir)).rejects.toThrow(
			".mcp.json exists but contains invalid JSON. Fix the syntax error and re-run.",
		);
	});

	it("created message includes existing server count when merging", async () => {
		const existing = {
			mcpServers: {
				obsidian: { command: "npx", args: ["@modelcontextprotocol/obsidian"] },
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
		expect(result.message).toContain("2 existing servers");
	});

	it("created message uses singular when merging with one existing server", async () => {
		const existing = {
			mcpServers: {
				obsidian: { command: "npx", args: ["@modelcontextprotocol/obsidian"] },
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
});
