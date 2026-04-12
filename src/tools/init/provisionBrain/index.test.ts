import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, mkdir, writeFile, readFile, readdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir, platform } from "node:os";
import provisionBrain from "./index.js";

const expectedObsidianEntry = (brainPath: string) =>
	platform() === "win32"
		? { command: "cmd", args: ["/c", "npx", "@bitbonsai/mcpvault", brainPath] }
		: { command: "npx", args: ["@bitbonsai/mcpvault", brainPath] };

let tempDir: string;

beforeEach(async () => {
	tempDir = await mkdtemp(join(tmpdir(), "aide-provision-brain-"));
});

afterEach(async () => {
	await rm(tempDir, { recursive: true, force: true });
});

function makeMcpPath(): string {
	return join(tempDir, ".mcp.json");
}

function makeBrainPath(): string {
	return join(tempDir, "brain");
}

describe("provisionBrain", () => {
	it("returns both results as skipped when brainPath is undefined", async () => {
		const mcpPath = makeMcpPath();

		const results = await provisionBrain(undefined, mcpPath);

		expect(results).toHaveLength(2);
		expect(results[0]).toEqual({ name: "Brain vault", status: "skipped" });
		expect(results[1]).toEqual({ name: "MCP config (obsidian)", status: "skipped" });
	});

	it("detects existing vault by .obsidian/ dir and wires MCP", async () => {
		const brainPath = makeBrainPath();
		const mcpPath = makeMcpPath();
		await mkdir(join(brainPath, ".obsidian"), { recursive: true });

		const results = await provisionBrain(brainPath, mcpPath);

		expect(results[0]).toEqual({ name: "Brain vault", status: "exists" });
		expect(results[1]).toEqual({ name: "MCP config (obsidian)", status: "wired" });

		const mcp = JSON.parse(await readFile(mcpPath, "utf-8"));
		expect(mcp.mcpServers.obsidian).toEqual(expectedObsidianEntry(brainPath));
	});

	it("creates vault with expected dirs when brainPath is empty location", async () => {
		const brainPath = makeBrainPath();
		const mcpPath = makeMcpPath();

		const results = await provisionBrain(brainPath, mcpPath);

		expect(results[0]).toEqual({ name: "Brain vault", status: "created" });
		expect(results[1]).toEqual({ name: "MCP config (obsidian)", status: "wired" });

		const entries = await readdir(brainPath);
		expect(entries).toContain("research");
		expect(entries).toContain("process");
		expect(entries).toContain("coding-playbook");

		const processEntries = await readdir(join(brainPath, "process"));
		expect(processEntries).toContain("retro");

		const mcp = JSON.parse(await readFile(mcpPath, "utf-8"));
		expect(mcp.mcpServers.obsidian).toEqual(expectedObsidianEntry(brainPath));
	});

	it("detects existing vault by .md files and returns vault exists", async () => {
		const brainPath = makeBrainPath();
		const mcpPath = makeMcpPath();
		await mkdir(brainPath, { recursive: true });
		await writeFile(join(brainPath, "notes.md"), "# Notes", "utf-8");

		const results = await provisionBrain(brainPath, mcpPath);

		expect(results[0]).toEqual({ name: "Brain vault", status: "exists" });
		expect(results[1]).toEqual({ name: "MCP config (obsidian)", status: "wired" });
	});

	it("returns both exists when vault and obsidian MCP entry already present", async () => {
		const brainPath = makeBrainPath();
		const mcpPath = makeMcpPath();
		await mkdir(join(brainPath, ".obsidian"), { recursive: true });
		const existing = {
			mcpServers: {
				obsidian: expectedObsidianEntry(brainPath),
			},
		};
		await writeFile(mcpPath, JSON.stringify(existing), "utf-8");

		const results = await provisionBrain(brainPath, mcpPath);

		expect(results[0]).toEqual({ name: "Brain vault", status: "exists" });
		expect(results[1]).toEqual({ name: "MCP config (obsidian)", status: "exists" });
	});

	it("skips MCP wiring when config file has invalid JSON", async () => {
		const brainPath = makeBrainPath();
		const mcpPath = makeMcpPath();
		await writeFile(mcpPath, "not valid json {{{", "utf-8");

		const results = await provisionBrain(brainPath, mcpPath);

		// Vault was created (empty location)
		expect(results[0]).toEqual({ name: "Brain vault", status: "created" });
		// MCP is skipped due to parse failure
		expect(results[1]).toEqual({ name: "MCP config (obsidian)", status: "skipped" });
	});

	it("preserves other MCP server entries when adding obsidian", async () => {
		const brainPath = makeBrainPath();
		const mcpPath = makeMcpPath();
		const existing = {
			mcpServers: {
				aide: { command: "npx", args: ["aidemd-mcp"] },
				other: { command: "node", args: ["other.js"] },
			},
		};
		await writeFile(mcpPath, JSON.stringify(existing), "utf-8");

		await provisionBrain(brainPath, mcpPath);

		const mcp = JSON.parse(await readFile(mcpPath, "utf-8"));
		expect(mcp.mcpServers.aide).toEqual({ command: "npx", args: ["aidemd-mcp"] });
		expect(mcp.mcpServers.other).toEqual({ command: "node", args: ["other.js"] });
		expect(mcp.mcpServers.obsidian).toEqual(expectedObsidianEntry(brainPath));
	});

	it("returns MCP exists when obsidian is present in user-level config, no project entry written", async () => {
		const brainPath = makeBrainPath();
		const mcpPath = makeMcpPath();
		const userMcpPath = join(tempDir, ".claude.json");

		// User-level config already has obsidian registered
		const userConfig = {
			mcpServers: {
				obsidian: expectedObsidianEntry(brainPath),
			},
		};
		await writeFile(userMcpPath, JSON.stringify(userConfig), "utf-8");

		const results = await provisionBrain(brainPath, mcpPath, userMcpPath);

		// Vault is still created (empty location)
		expect(results[0]).toEqual({ name: "Brain vault", status: "created" });
		// MCP reports exists — already configured at user level
		expect(results[1]).toEqual({ name: "MCP config (obsidian)", status: "exists" });

		// Project-level MCP config must NOT have been written
		await expect(readFile(mcpPath, "utf-8")).rejects.toThrow();
	});

	it("falls through to project-level check when user-level config has no obsidian entry", async () => {
		const brainPath = makeBrainPath();
		const mcpPath = makeMcpPath();
		const userMcpPath = join(tempDir, ".claude.json");

		// User-level config exists but lacks obsidian
		const userConfig = { mcpServers: { aide: { command: "npx", args: ["aidemd-mcp"] } } };
		await writeFile(userMcpPath, JSON.stringify(userConfig), "utf-8");

		const results = await provisionBrain(brainPath, mcpPath, userMcpPath);

		// Should fall through and wire at the project level
		expect(results[1]).toEqual({ name: "MCP config (obsidian)", status: "wired" });
		const mcp = JSON.parse(await readFile(mcpPath, "utf-8"));
		expect(mcp.mcpServers.obsidian).toEqual(expectedObsidianEntry(brainPath));
	});

	it("ignores a malformed user-level config and falls through to project-level check", async () => {
		const brainPath = makeBrainPath();
		const mcpPath = makeMcpPath();
		const userMcpPath = join(tempDir, ".claude.json");

		// Malformed user-level config
		await writeFile(userMcpPath, "not valid json {{{", "utf-8");

		const results = await provisionBrain(brainPath, mcpPath, userMcpPath);

		// Parse failure is silently ignored; project-level wiring proceeds
		expect(results[1]).toEqual({ name: "MCP config (obsidian)", status: "wired" });
	});

	it("is idempotent — second run reports exists for both", async () => {
		const brainPath = makeBrainPath();
		const mcpPath = makeMcpPath();

		const first = await provisionBrain(brainPath, mcpPath);
		expect(first[0].status).toBe("created");
		expect(first[1].status).toBe("wired");

		const second = await provisionBrain(brainPath, mcpPath);
		expect(second[0]).toEqual({ name: "Brain vault", status: "exists" });
		expect(second[1]).toEqual({ name: "MCP config (obsidian)", status: "exists" });
	});
});
