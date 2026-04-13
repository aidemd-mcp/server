import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
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
	it("returns four steps: vault, playbook hub, vault CLAUDE.md, and obsidian MCP", async () => {
		const brainPath = makeBrainPath();
		const mcpPath = makeMcpPath();

		const results = await provisionBrain(brainPath, mcpPath);

		expect(results).toHaveLength(4);
		expect(results[0].name).toBe("Brain vault");
		expect(results[1].name).toBe("Playbook hub");
		expect(results[2].name).toBe("Vault CLAUDE.md");
		expect(results[3].name).toBe("MCP config (obsidian)");
	});

	it("returns vault would-create with dirs content for a new location", async () => {
		const brainPath = makeBrainPath();
		const mcpPath = makeMcpPath();

		const results = await provisionBrain(brainPath, mcpPath);

		expect(results[0].status).toBe("would-create");
		expect(results[0].category).toBe("brain");
		// content is a JSON array of directories to create
		expect(results[0].content).toBeTruthy();
		const dirs = JSON.parse(results[0].content!);
		expect(Array.isArray(dirs)).toBe(true);
		expect(dirs).toContain("research");
		expect(dirs).toContain("coding-playbook");
	});

	it("returns obsidian MCP would-create with prescription for new config", async () => {
		const brainPath = makeBrainPath();
		const mcpPath = makeMcpPath();

		const results = await provisionBrain(brainPath, mcpPath);

		expect(results[3].status).toBe("would-create");
		expect(results[3].category).toBe("mcp");
		expect(results[3].prescription?.key).toBe("obsidian");
		expect(results[3].prescription?.entry).toEqual(expectedObsidianEntry(brainPath));
	});

	it("detects existing vault by .obsidian/ dir — vault step returns exists", async () => {
		const brainPath = makeBrainPath();
		const mcpPath = makeMcpPath();
		await mkdir(join(brainPath, ".obsidian"), { recursive: true });

		const results = await provisionBrain(brainPath, mcpPath);

		expect(results[0].status).toBe("exists");
		expect(results[0].content).toBeUndefined();
	});

	it("detects existing vault by non-empty dir — vault step returns exists", async () => {
		const brainPath = makeBrainPath();
		const mcpPath = makeMcpPath();
		await mkdir(brainPath, { recursive: true });
		await writeFile(join(brainPath, "notes.md"), "# Notes", "utf-8");

		const results = await provisionBrain(brainPath, mcpPath);

		expect(results[0].status).toBe("exists");
	});

	it("detects existing obsidian MCP entry — MCP step returns exists", async () => {
		const brainPath = makeBrainPath();
		const mcpPath = makeMcpPath();
		const existing = {
			mcpServers: {
				obsidian: expectedObsidianEntry(brainPath),
			},
		};
		await writeFile(mcpPath, JSON.stringify(existing), "utf-8");

		const results = await provisionBrain(brainPath, mcpPath);

		expect(results[3].status).toBe("exists");
		expect(results[3].prescription).toBeUndefined();
	});

	it("returns configMalformed when MCP config has invalid JSON", async () => {
		const brainPath = makeBrainPath();
		const mcpPath = makeMcpPath();
		await writeFile(mcpPath, "not valid json {{{", "utf-8");

		const results = await provisionBrain(brainPath, mcpPath);

		expect(results[3].status).toBe("would-create");
		expect(results[3].configMalformed).toBe(true);
		// Prescription is still provided so agent can proceed
		expect(results[3].prescription).toBeDefined();
	});

	it("never writes to disk", async () => {
		const brainPath = makeBrainPath();
		const mcpPath = makeMcpPath();

		await provisionBrain(brainPath, mcpPath);

		// Neither the brain dir, the playbook hub, the vault CLAUDE.md, nor the MCP config should have been created
		await expect(import("node:fs/promises").then((fs) => fs.access(brainPath))).rejects.toThrow();
		await expect(
			import("node:fs/promises").then((fs) =>
				fs.access(join(brainPath, "coding-playbook", "coding-playbook.md")),
			),
		).rejects.toThrow();
		await expect(
			import("node:fs/promises").then((fs) => fs.access(join(brainPath, "CLAUDE.md"))),
		).rejects.toThrow();
		await expect(import("node:fs/promises").then((fs) => fs.readFile(mcpPath, "utf-8"))).rejects.toThrow();
	});

	it("new vault returns playbook hub as would-create with five-section Markdown content", async () => {
		const brainPath = makeBrainPath();
		const mcpPath = makeMcpPath();

		const results = await provisionBrain(brainPath, mcpPath);
		const hubStep = results[1];

		expect(hubStep.name).toBe("Playbook hub");
		expect(hubStep.status).toBe("would-create");
		expect(hubStep.category).toBe("brain");
		expect(hubStep.content).toBeTruthy();
		expect(hubStep.content).toContain("## Task Routing");
		expect(hubStep.content).toContain("## How to Use This Index");
		expect(hubStep.content).toContain("## Always Read First");
		expect(hubStep.content).toContain("## Sections");
		expect(hubStep.content).toContain("## Contents");
		// Wikilinks must be placeholders — resolved note names fabricate content for a new vault
		expect(hubStep.content).not.toContain("[[conventions]]");
		expect(hubStep.content).not.toContain("[[folder-structure]]");
	});

	it("existing playbook hub file returns playbook hub step as exists with no content", async () => {
		const brainPath = makeBrainPath();
		const mcpPath = makeMcpPath();

		await mkdir(join(brainPath, ".obsidian"), { recursive: true });
		await mkdir(join(brainPath, "coding-playbook"), { recursive: true });
		await writeFile(join(brainPath, "coding-playbook", "coding-playbook.md"), "# Hub", "utf-8");

		const results = await provisionBrain(brainPath, mcpPath);
		const hubStep = results[1];

		expect(hubStep.status).toBe("exists");
		expect(hubStep.content).toBeUndefined();
	});

	it("partial vault — directories exist but playbook hub missing returns vault exists, hub would-create", async () => {
		const brainPath = makeBrainPath();
		const mcpPath = makeMcpPath();

		await mkdir(join(brainPath, ".obsidian"), { recursive: true });

		const results = await provisionBrain(brainPath, mcpPath);

		expect(results[0].status).toBe("exists");
		expect(results[1].status).toBe("would-create");
		expect(results[1].name).toBe("Playbook hub");
	});

	it("vault would-create step has the correct filePath", async () => {
		const brainPath = makeBrainPath();
		const mcpPath = makeMcpPath();

		const results = await provisionBrain(brainPath, mcpPath);

		expect(results[0].filePath).toBe(brainPath);
	});

	it("new vault returns vault CLAUDE.md as would-create with navigation content", async () => {
		const brainPath = makeBrainPath();
		const mcpPath = makeMcpPath();

		const results = await provisionBrain(brainPath, mcpPath);
		const claudeStep = results[2];

		expect(claudeStep.name).toBe("Vault CLAUDE.md");
		expect(claudeStep.status).toBe("would-create");
		expect(claudeStep.category).toBe("brain");
		expect(claudeStep.content).toBeTruthy();
		expect(claudeStep.content).toContain("Wikilink Crawling Protocol");
		expect(claudeStep.content).toContain("Decision Protocol");
		expect(claudeStep.content).toContain("Where to Find Things");
		expect(claudeStep.content).toContain("Brain");
	});

	it("existing vault CLAUDE.md returns vault CLAUDE.md step as exists with no content", async () => {
		const brainPath = makeBrainPath();
		const mcpPath = makeMcpPath();

		await mkdir(join(brainPath, ".obsidian"), { recursive: true });
		await writeFile(join(brainPath, "CLAUDE.md"), "# Navigation", "utf-8");

		const results = await provisionBrain(brainPath, mcpPath);
		const claudeStep = results[2];

		expect(claudeStep.name).toBe("Vault CLAUDE.md");
		expect(claudeStep.status).toBe("exists");
		expect(claudeStep.content).toBeUndefined();
	});

	it("partial vault — directories exist but CLAUDE.md missing returns CLAUDE.md as would-create", async () => {
		const brainPath = makeBrainPath();
		const mcpPath = makeMcpPath();

		await mkdir(join(brainPath, ".obsidian"), { recursive: true });
		await mkdir(join(brainPath, "coding-playbook"), { recursive: true });
		await writeFile(join(brainPath, "coding-playbook", "coding-playbook.md"), "# Hub", "utf-8");

		const results = await provisionBrain(brainPath, mcpPath);

		expect(results[0].status).toBe("exists");
		expect(results[1].status).toBe("exists");
		expect(results[2].status).toBe("would-create");
		expect(results[2].name).toBe("Vault CLAUDE.md");
		expect(results[3].name).toBe("MCP config (obsidian)");
	});

	it("is idempotent — second call with fully provisioned vault returns all exists", async () => {
		const brainPath = makeBrainPath();
		const mcpPath = makeMcpPath();

		// Simulate fully provisioned state
		await mkdir(join(brainPath, ".obsidian"), { recursive: true });
		await mkdir(join(brainPath, "coding-playbook"), { recursive: true });
		await writeFile(join(brainPath, "coding-playbook", "coding-playbook.md"), "# Hub", "utf-8");
		await writeFile(join(brainPath, "CLAUDE.md"), "# Navigation", "utf-8");
		const existing = { mcpServers: { obsidian: expectedObsidianEntry(brainPath) } };
		await writeFile(mcpPath, JSON.stringify(existing), "utf-8");

		const results = await provisionBrain(brainPath, mcpPath);

		expect(results[0].status).toBe("exists");
		expect(results[1].status).toBe("exists");
		expect(results[2].status).toBe("exists");
		expect(results[3].status).toBe("exists");
	});
});
