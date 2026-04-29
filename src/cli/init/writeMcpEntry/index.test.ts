import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import writeMcpEntry from "./index.js";
import { mcpEntry } from "@/service/install/wireMcp/index.js";

let tempDir: string;

beforeEach(async () => {
	tempDir = await mkdtemp(join(tmpdir(), "aide-init-writemcp-"));
});

afterEach(async () => {
	await rm(tempDir, { recursive: true, force: true });
});

// Helper: read and parse .mcp.json from tempDir.
async function readMcpJson(): Promise<Record<string, unknown>> {
	const raw = await readFile(join(tempDir, ".mcp.json"), "utf-8");
	return JSON.parse(raw) as Record<string, unknown>;
}

describe("writeMcpEntry (init wrapper)", () => {
	// --- Fresh install: no .mcp.json ---

	it("fresh install — creates .mcp.json with exactly one key (aide) equal to mcpEntry()", async () => {
		const result = await writeMcpEntry(tempDir);

		expect(result.status).toBe("created");
		expect(result.message).toBe("aide MCP server entry");

		const parsed = await readMcpJson();
		const servers = parsed.mcpServers as Record<string, unknown>;

		expect(Object.keys(servers)).toEqual(["aide"]);
		expect(servers.aide).toEqual(mcpEntry());
	});

	// --- Idempotent re-run: aide already present ---

	it("idempotent re-run — returns exists and does not modify the file", async () => {
		await writeMcpEntry(tempDir);

		const before = await readFile(join(tempDir, ".mcp.json"), "utf-8");

		const result = await writeMcpEntry(tempDir);

		expect(result.status).toBe("exists");
		expect(result.message).toBe("aide MCP server entry already configured");

		const after = await readFile(join(tempDir, ".mcp.json"), "utf-8");
		expect(after).toBe(before);
	});

	// --- Additive merge: preserves pre-existing non-managed servers ---

	it("additive merge — preserves github and local-llm, adds aide, message includes count", async () => {
		const githubEntry = { command: "npx", args: ["@modelcontextprotocol/github"] };
		const localLlmEntry = { command: "npx", args: ["@modelcontextprotocol/local-llm"] };
		const existing = {
			mcpServers: { github: githubEntry, "local-llm": localLlmEntry },
		};
		await writeFile(join(tempDir, ".mcp.json"), JSON.stringify(existing, null, 2), "utf-8");

		const result = await writeMcpEntry(tempDir);

		expect(result.status).toBe("created");
		expect(result.message).toContain("merged with 2 existing servers");

		const parsed = await readMcpJson();
		const servers = parsed.mcpServers as Record<string, unknown>;

		expect(servers.aide).toEqual(mcpEntry());
		expect(servers.github).toEqual(githubEntry);
		expect(servers["local-llm"]).toEqual(localLlmEntry);
		expect(Object.keys(servers).sort()).toEqual(["aide", "github", "local-llm"].sort());
	});

	// --- Legacy obsidian key: untouched, counts as non-managed ---

	it("legacy obsidian key — left untouched, no brain key written, preserved count includes obsidian", async () => {
		const obsidianEntry = { command: "npx", args: ["@bitbonsai/mcpvault", "/old/vault"] };
		const existing = { mcpServers: { obsidian: obsidianEntry } };
		await writeFile(join(tempDir, ".mcp.json"), JSON.stringify(existing, null, 2), "utf-8");

		const result = await writeMcpEntry(tempDir);

		expect(result.status).toBe("created");
		expect(result.message).toContain("merged with 1 existing server");

		const parsed = await readMcpJson();
		const servers = parsed.mcpServers as Record<string, unknown>;

		expect(servers.aide).toEqual(mcpEntry());
		expect(servers.obsidian).toEqual(obsidianEntry);
		expect(servers.brain).toBeUndefined();
	});

	// --- Pre-existing brain key (e.g. from prior /aide:brain config + sync): untouched ---

	it("pre-existing brain key — left untouched, aide added, preserved count includes brain", async () => {
		const brainEntry = { command: "cmd", args: ["/c", "npx", "@bitbonsai/mcpvault", "/my/vault"] };
		const existing = { mcpServers: { brain: brainEntry } };
		await writeFile(join(tempDir, ".mcp.json"), JSON.stringify(existing, null, 2), "utf-8");

		const result = await writeMcpEntry(tempDir);

		expect(result.status).toBe("created");
		expect(result.message).toContain("merged with 1 existing server");

		const parsed = await readMcpJson();
		const servers = parsed.mcpServers as Record<string, unknown>;

		expect(servers.aide).toEqual(mcpEntry());
		expect(servers.brain).toEqual(brainEntry);
	});

	// --- Malformed JSON throws ---

	it("throws on malformed .mcp.json", async () => {
		await writeFile(join(tempDir, ".mcp.json"), "{ not valid json {{{{", "utf-8");

		await expect(writeMcpEntry(tempDir)).rejects.toThrow(".mcp.json");
		await expect(writeMcpEntry(tempDir)).rejects.toThrow("invalid JSON");
	});

	// --- Format fidelity ---

	it("writes JSON with 2-space indent and a trailing newline", async () => {
		await writeMcpEntry(tempDir);

		const written = await readFile(join(tempDir, ".mcp.json"), "utf-8");

		expect(written).toMatch(/^\{/);
		expect(written.endsWith("\n")).toBe(true);
		expect(written).toContain('  "mcpServers"');
	});

	// --- Top-level keys outside mcpServers are preserved ---

	it("preserves top-level keys outside mcpServers", async () => {
		const existing = {
			someOtherKey: "preserve-me",
			mcpServers: { other: { command: "node", args: ["other.js"] } },
		};
		await writeFile(join(tempDir, ".mcp.json"), JSON.stringify(existing, null, 2), "utf-8");

		await writeMcpEntry(tempDir);

		const parsed = await readMcpJson();
		expect((parsed as { someOtherKey: string }).someOtherKey).toBe("preserve-me");
	});

	// --- No merged suffix when count is zero ---

	it("message has no merged suffix when no non-managed servers exist", async () => {
		const result = await writeMcpEntry(tempDir);

		expect(result.message).toBe("aide MCP server entry");
		expect(result.message).not.toContain("merged with 0");
	});

	// --- Singular form for one preserved server ---

	it("message uses singular form when one non-managed server is preserved", async () => {
		const existing = { mcpServers: { github: { command: "npx", args: ["@modelcontextprotocol/github"] } } };
		await writeFile(join(tempDir, ".mcp.json"), JSON.stringify(existing, null, 2), "utf-8");

		const result = await writeMcpEntry(tempDir);

		expect(result.message).toContain("merged with 1 existing server");
		expect(result.message).not.toMatch(/\d+ existing servers/);
	});
});
