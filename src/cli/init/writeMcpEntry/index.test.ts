import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, writeFile, readFile, mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import writeMcpEntry from "./index.js";
import { mcpEntry } from "@/service/install/wireMcp/index.js";
import obsidianBrainAideTemplate from "@/service/install/provisionBrain/obsidianBrainAideTemplate/index.js";
import { parseBrainAideFromString, interpolateArgs } from "@/service/parseBrainAide/index.js";

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

// Helper: get the expected brain entry derived from the template for a given brain root path.
function expectedBrainEntry(vaultPath: string) {
	const content = obsidianBrainAideTemplate(vaultPath);
	const result = parseBrainAideFromString(content);
	if (result.kind !== "ok") throw new Error("Template did not parse");
	return { command: result.config.mcpServerConfig.command, args: interpolateArgs(result.config) };
}

describe("writeMcpEntry (init wrapper)", () => {
	// --- 2a. vaultPath supplied + no existing brain.aide ---

	it("2a: vaultPath supplied, no brain.aide on disk — reads in-memory template, derives brain entry, writes to .mcp.json", async () => {
		const result = await writeMcpEntry(tempDir, "/my/vault");

		expect(result.status).toBe("created");

		const parsed = await readMcpJson();
		const servers = parsed.mcpServers as Record<string, unknown>;

		expect(servers.aide).toEqual(mcpEntry());
		expect(servers.brain).toEqual(expectedBrainEntry("/my/vault"));
		// obsidian key should be absent (never existed) — delete of absent key is a no-op
		expect(servers.obsidian).toBeUndefined();
	});

	it("2a: brain entry args contain the real brain root path, not the placeholder", async () => {
		await writeMcpEntry(tempDir, "/some/real/vault");

		const parsed = await readMcpJson();
		const servers = parsed.mcpServers as Record<string, unknown>;
		const brain = servers.brain as { command: string; args: string[] };

		// The literal placeholder ${rootPath} must not appear in the written args.
		for (const arg of brain.args) {
			expect(arg).not.toContain("${rootPath}");
		}
		// The brain root path must appear somewhere in the args.
		expect(brain.args.some((a) => a.includes("/some/real/vault"))).toBe(true);
	});

	// --- 2b. vaultPath supplied + existing user-edited brain.aide ---

	it("2b: vaultPath supplied + existing user-edited brain.aide — reads file, derives entry from user config", async () => {
		// Scaffold a hand-edited brain.aide with a different brain root path than the supplied one.
		const userVaultPath = "/user/custom/vault";
		const brainAideDir = join(tempDir, ".aide", "config");
		await mkdir(brainAideDir, { recursive: true });
		const userContent = obsidianBrainAideTemplate(userVaultPath);
		await writeFile(join(brainAideDir, "brain.aide"), userContent, "utf-8");

		// Call with a different vaultPath — the helper should respect the on-disk file.
		const result = await writeMcpEntry(tempDir, "/different/vault");

		expect(result.status).toBe("created");

		const parsed = await readMcpJson();
		const servers = parsed.mcpServers as Record<string, unknown>;
		const brain = servers.brain as { command: string; args: string[] };

		// The brain entry must reflect the user's on-disk brain.aide (userVaultPath),
		// not the supplied vaultPath (/different/vault).
		expect(brain.args.some((a) => a.includes(userVaultPath))).toBe(true);
		expect(brain.args.some((a) => a.includes("/different/vault"))).toBe(false);
	});

	it("2b: user-edited brain.aide with custom rootPath wins over template", async () => {
		const brainAideDir = join(tempDir, ".aide", "config");
		await mkdir(brainAideDir, { recursive: true });
		// Write template for /original/path
		const original = obsidianBrainAideTemplate("/original/path");
		await writeFile(join(brainAideDir, "brain.aide"), original, "utf-8");

		await writeMcpEntry(tempDir, "/new/path");

		const parsed = await readMcpJson();
		const servers = parsed.mcpServers as Record<string, unknown>;
		const brain = servers.brain as { command: string; args: string[] };

		// Must use /original/path from the on-disk file, not /new/path from the arg.
		expect(brain.args.some((a) => a.includes("/original/path"))).toBe(true);
		expect(brain.args.some((a) => a.includes("/new/path"))).toBe(false);
	});

	// --- 2c. vaultPath absent — only aide is written ---

	it("2c: vaultPath absent — only aide entry is written, brain is not included", async () => {
		const result = await writeMcpEntry(tempDir);

		expect(result.status).toBe("created");

		const parsed = await readMcpJson();
		const servers = parsed.mcpServers as Record<string, unknown>;

		expect(servers.aide).toEqual(mcpEntry());
		expect(servers.brain).toBeUndefined();
	});

	it("2c: vaultPath absent — message does not mention brain or placeholder", async () => {
		const result = await writeMcpEntry(tempDir);

		// The message should not include brain-related placeholders from the old implementation.
		expect(result.message).not.toContain("placeholder");
	});

	// --- 2d. Idempotent re-run ---

	it("2d: idempotent re-run with vaultPath — returns exists on second call", async () => {
		// First run
		await writeMcpEntry(tempDir, "/my/vault");

		// Second run — all entries already in sync
		const result = await writeMcpEntry(tempDir, "/my/vault");

		expect(result.status).toBe("exists");
	});

	it("2d: idempotent re-run without vaultPath — returns exists on second call", async () => {
		await writeMcpEntry(tempDir);
		const result = await writeMcpEntry(tempDir);

		expect(result.status).toBe("exists");
	});

	it("2d: idempotent re-run does not modify the file", async () => {
		await writeMcpEntry(tempDir, "/my/vault");

		const beforeJson = await readFile(join(tempDir, ".mcp.json"), "utf-8");

		await writeMcpEntry(tempDir, "/my/vault");

		const afterJson = await readFile(join(tempDir, ".mcp.json"), "utf-8");
		expect(afterJson).toBe(beforeJson);
	});

	// --- 2e. Legacy obsidian key migration via shared helper ---

	it("2e: when vaultPath is supplied, the obsidian key is removed from an existing config", async () => {
		const existing = {
			mcpServers: {
				obsidian: { command: "npx", args: ["@bitbonsai/mcpvault", "/old/vault"] },
			},
		};
		await writeFile(join(tempDir, ".mcp.json"), JSON.stringify(existing, null, 2), "utf-8");

		const result = await writeMcpEntry(tempDir, "/my/vault");

		expect(result.status).toBe("created");

		const parsed = await readMcpJson();
		const servers = parsed.mcpServers as Record<string, unknown>;

		// obsidian key must be gone.
		expect(servers.obsidian).toBeUndefined();
		// brain and aide must be present.
		expect(servers.brain).toBeDefined();
		expect(servers.aide).toEqual(mcpEntry());
	});

	it("2e: when vaultPath is absent, the obsidian key is preserved (no migration without path)", async () => {
		const obsidianEntry = { command: "npx", args: ["@bitbonsai/mcpvault", "/old/vault"] };
		const existing = { mcpServers: { obsidian: obsidianEntry } };
		await writeFile(join(tempDir, ".mcp.json"), JSON.stringify(existing, null, 2), "utf-8");

		await writeMcpEntry(tempDir);

		const parsed = await readMcpJson();
		const servers = parsed.mcpServers as Record<string, unknown>;

		// obsidian must still be there — only vaultPath path triggers migration.
		expect(servers.obsidian).toEqual(obsidianEntry);
	});

	// --- Additional coverage ---

	it("preserves other existing MCP server entries during merge", async () => {
		const existing = {
			mcpServers: {
				github: { command: "npx", args: ["@modelcontextprotocol/github"] },
				slack: { command: "npx", args: ["@modelcontextprotocol/slack"] },
			},
		};
		await writeFile(join(tempDir, ".mcp.json"), JSON.stringify(existing, null, 2), "utf-8");

		await writeMcpEntry(tempDir, "/my/vault");

		const parsed = await readMcpJson();
		const servers = parsed.mcpServers as Record<string, unknown>;

		expect(servers.github).toEqual(existing.mcpServers.github);
		expect(servers.slack).toEqual(existing.mcpServers.slack);
	});

	it("message includes existing server count when merging with non-managed servers", async () => {
		const existing = {
			mcpServers: {
				github: { command: "npx", args: ["@modelcontextprotocol/github"] },
				slack: { command: "npx", args: ["@modelcontextprotocol/slack"] },
			},
		};
		await writeFile(join(tempDir, ".mcp.json"), JSON.stringify(existing, null, 2), "utf-8");

		const result = await writeMcpEntry(tempDir, "/my/vault");

		expect(result.status).toBe("created");
		expect(result.message).toContain("2 existing servers");
	});

	it("message uses singular when merging with one existing server", async () => {
		const existing = {
			mcpServers: {
				github: { command: "npx", args: ["@modelcontextprotocol/github"] },
			},
		};
		await writeFile(join(tempDir, ".mcp.json"), JSON.stringify(existing, null, 2), "utf-8");

		const result = await writeMcpEntry(tempDir, "/my/vault");

		expect(result.message).toContain("1 existing server");
		expect(result.message).not.toContain("servers");
	});

	it("throws on malformed JSON — the only abort trigger for the CLI", async () => {
		await writeFile(join(tempDir, ".mcp.json"), "{ not valid json {{{{", "utf-8");

		await expect(writeMcpEntry(tempDir)).rejects.toThrow(
			".mcp.json exists but contains invalid JSON. Fix the syntax error and re-run.",
		);
	});

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

	it("writes JSON with 2-space indent and trailing newline", async () => {
		await writeMcpEntry(tempDir);

		const written = await readFile(join(tempDir, ".mcp.json"), "utf-8");

		expect(written).toMatch(/^\{/);
		expect(written.endsWith("\n")).toBe(true);
		expect(written).toContain('  "mcpServers"');
	});

	// --- 8e. Regression: deprecated-field rejection flows through writeMcpEntry ---

	it("8e: vaultPath supplied + .aide/config/brain.aide with deprecated connector field — throws naming the path and field", async () => {
		// Pre-write a brain.aide that looks like a pre-migration install: it has the
		// required fields present (so the parser reaches the deprecated-field check)
		// but also carries the deprecated 'connector' field left from the old schema.
		const brainAideDir = join(tempDir, ".aide", "config");
		await mkdir(brainAideDir, { recursive: true });
		const deprecatedContent = [
			"---",
			"name: 'obsidian'",
			"connector: obsidian",
			"mcpServerConfig:",
			"  command: npx",
			"  args:",
			"    - '-y'",
			"    - '@bitbonsai/mcpvault'",
			"    - '/old/vault'",
			"---",
			"",
			"## Prose",
			"Brain.",
		].join("\n");
		await writeFile(join(brainAideDir, "brain.aide"), deprecatedContent, "utf-8");

		// writeMcpEntry must throw via parseBrainAideFromString's malformed-frontmatter
		// branch with a message naming .aide/config/brain.aide and the deprecated field.
		await expect(writeMcpEntry(tempDir, "/my/vault")).rejects.toThrow(
			".aide/config/brain.aide",
		);
		await expect(writeMcpEntry(tempDir, "/my/vault")).rejects.toThrow("connector");
	});
});
