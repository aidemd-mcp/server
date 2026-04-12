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
	it("returns two steps: vault and obsidian MCP", async () => {
		const brainPath = makeBrainPath();
		const mcpPath = makeMcpPath();

		const results = await provisionBrain(brainPath, mcpPath);

		expect(results).toHaveLength(2);
		expect(results[0].name).toBe("Brain vault");
		expect(results[1].name).toBe("MCP config (obsidian)");
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

		expect(results[1].status).toBe("would-create");
		expect(results[1].category).toBe("mcp");
		expect(results[1].prescription?.key).toBe("obsidian");
		expect(results[1].prescription?.entry).toEqual(expectedObsidianEntry(brainPath));
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

		expect(results[1].status).toBe("exists");
		expect(results[1].prescription).toBeUndefined();
	});

	it("returns configMalformed when MCP config has invalid JSON", async () => {
		const brainPath = makeBrainPath();
		const mcpPath = makeMcpPath();
		await writeFile(mcpPath, "not valid json {{{", "utf-8");

		const results = await provisionBrain(brainPath, mcpPath);

		expect(results[1].status).toBe("would-create");
		expect(results[1].configMalformed).toBe(true);
		// Prescription is still provided so agent can proceed
		expect(results[1].prescription).toBeDefined();
	});

	it("never writes to disk", async () => {
		const brainPath = makeBrainPath();
		const mcpPath = makeMcpPath();

		await provisionBrain(brainPath, mcpPath);

		// Neither the brain dir nor the MCP config should have been created
		await expect(import("node:fs/promises").then((fs) => fs.access(brainPath))).rejects.toThrow();
		await expect(import("node:fs/promises").then((fs) => fs.readFile(mcpPath, "utf-8"))).rejects.toThrow();
	});

	it("vault would-create step has the correct filePath", async () => {
		const brainPath = makeBrainPath();
		const mcpPath = makeMcpPath();

		const results = await provisionBrain(brainPath, mcpPath);

		expect(results[0].filePath).toBe(brainPath);
	});

	it("is idempotent — second call with existing vault and MCP returns both exists", async () => {
		const brainPath = makeBrainPath();
		const mcpPath = makeMcpPath();

		// Simulate fully provisioned state
		await mkdir(join(brainPath, ".obsidian"), { recursive: true });
		const existing = { mcpServers: { obsidian: expectedObsidianEntry(brainPath) } };
		await writeFile(mcpPath, JSON.stringify(existing), "utf-8");

		const results = await provisionBrain(brainPath, mcpPath);

		expect(results[0].status).toBe("exists");
		expect(results[1].status).toBe("exists");
	});
});
