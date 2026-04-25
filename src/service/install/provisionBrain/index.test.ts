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

	it("existing playbook hub file byte-identical to template returns playbook hub step as exists with no content", async () => {
		const brainPath = makeBrainPath();
		const mcpPath = makeMcpPath();

		// Get canonical content from the first call
		const firstResults = await provisionBrain(brainPath, mcpPath);
		const canonicalHub = firstResults[1].content!;

		await mkdir(join(brainPath, ".obsidian"), { recursive: true });
		await mkdir(join(brainPath, "coding-playbook"), { recursive: true });
		await writeFile(join(brainPath, "coding-playbook", "coding-playbook.md"), canonicalHub, "utf-8");

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

	it("existing vault CLAUDE.md byte-identical to template returns vault CLAUDE.md step as exists with no content", async () => {
		const brainPath = makeBrainPath();
		const mcpPath = makeMcpPath();

		// Get canonical content from the first call
		const firstResults = await provisionBrain(brainPath, mcpPath);
		const canonicalClaudeMd = firstResults[2].content!;

		await mkdir(join(brainPath, ".obsidian"), { recursive: true });
		await writeFile(join(brainPath, "CLAUDE.md"), canonicalClaudeMd, "utf-8");

		const results = await provisionBrain(brainPath, mcpPath);
		const claudeStep = results[2];

		expect(claudeStep.name).toBe("Vault CLAUDE.md");
		expect(claudeStep.status).toBe("exists");
		expect(claudeStep.content).toBeUndefined();
	});

	it("partial vault — directories exist but CLAUDE.md missing returns CLAUDE.md as would-create", async () => {
		const brainPath = makeBrainPath();
		const mcpPath = makeMcpPath();

		// Get canonical hub content to write byte-identical file
		const firstResults = await provisionBrain(brainPath, mcpPath);
		const canonicalHub = firstResults[1].content!;

		await mkdir(join(brainPath, ".obsidian"), { recursive: true });
		await mkdir(join(brainPath, "coding-playbook"), { recursive: true });
		await writeFile(join(brainPath, "coding-playbook", "coding-playbook.md"), canonicalHub, "utf-8");

		const results = await provisionBrain(brainPath, mcpPath);

		expect(results[0].status).toBe("exists");
		expect(results[1].status).toBe("exists");
		expect(results[2].status).toBe("would-create");
		expect(results[2].name).toBe("Vault CLAUDE.md");
		expect(results[3].name).toBe("MCP config (obsidian)");
	});

	// -------------------------------------------------------------------------
	// Drift cases: playbook hub byte-compare
	// -------------------------------------------------------------------------

	it("playbook hub byte-identical to template returns exists", async () => {
		const brainPath = makeBrainPath();
		const mcpPath = makeMcpPath();

		// First call to get the canonical content
		const firstResults = await provisionBrain(brainPath, mcpPath);
		const canonicalContent = firstResults[1].content!;

		// Write the byte-identical template to disk
		await mkdir(join(brainPath, "coding-playbook"), { recursive: true });
		await writeFile(join(brainPath, "coding-playbook", "coding-playbook.md"), canonicalContent, "utf-8");

		const results = await provisionBrain(brainPath, mcpPath);
		const hubStep = results[1];

		expect(hubStep.status).toBe("exists");
		expect(hubStep.content).toBeUndefined();
	});

	it("playbook hub drifted from template still returns exists — user owns the bytes post-scaffold", async () => {
		// Spec trace:
		//   outcomes.desired — "When either file exists on disk at its expected path, the corresponding
		//     InitStep is returned with status: 'exists' regardless of byte drift from the bundled template."
		//   outcomes.undesired — "The coding-playbook hub or vault-root CLAUDE.md being returned with
		//     status: 'would-overwrite' under any circumstance — even when on-disk bytes have drifted
		//     from the bundled template."
		const brainPath = makeBrainPath();
		const mcpPath = makeMcpPath();

		// Get canonical content then modify it
		const firstResults = await provisionBrain(brainPath, mcpPath);
		const driftedContent = firstResults[1].content! + "\n## Extra Section\n\nUnexpected drift.\n";

		await mkdir(join(brainPath, "coding-playbook"), { recursive: true });
		await writeFile(join(brainPath, "coding-playbook", "coding-playbook.md"), driftedContent, "utf-8");

		const results = await provisionBrain(brainPath, mcpPath);
		const hubStep = results[1];

		expect(hubStep.status).toBe("exists");
		expect(hubStep.content).toBeUndefined();
	});

	it("playbook hub missing returns would-create with content", async () => {
		const brainPath = makeBrainPath();
		const mcpPath = makeMcpPath();

		// Vault exists but playbook hub is absent
		await mkdir(join(brainPath, ".obsidian"), { recursive: true });

		const results = await provisionBrain(brainPath, mcpPath);
		const hubStep = results[1];

		expect(hubStep.status).toBe("would-create");
		expect(hubStep.content).toBeTruthy();
	});

	// -------------------------------------------------------------------------
	// Drift cases: vault CLAUDE.md byte-compare
	// -------------------------------------------------------------------------

	it("vault CLAUDE.md byte-identical to template returns exists", async () => {
		const brainPath = makeBrainPath();
		const mcpPath = makeMcpPath();

		// First call to get the canonical content
		const firstResults = await provisionBrain(brainPath, mcpPath);
		const canonicalContent = firstResults[2].content!;

		// Write the byte-identical template to disk
		await mkdir(brainPath, { recursive: true });
		await writeFile(join(brainPath, "CLAUDE.md"), canonicalContent, "utf-8");

		const results = await provisionBrain(brainPath, mcpPath);
		const claudeStep = results[2];

		expect(claudeStep.status).toBe("exists");
		expect(claudeStep.content).toBeUndefined();
	});

	it("vault CLAUDE.md drifted from template still returns exists — user owns the bytes post-scaffold", async () => {
		// Spec trace:
		//   outcomes.desired — "When either file exists on disk at its expected path, the corresponding
		//     InitStep is returned with status: 'exists' regardless of byte drift from the bundled template."
		//   outcomes.undesired — "The coding-playbook hub or vault-root CLAUDE.md being returned with
		//     status: 'would-overwrite' under any circumstance — even when on-disk bytes have drifted
		//     from the bundled template."
		const brainPath = makeBrainPath();
		const mcpPath = makeMcpPath();

		// Get canonical content then modify it
		const firstResults = await provisionBrain(brainPath, mcpPath);
		const driftedContent = firstResults[2].content! + "\n## Extra\n\nDrifted content.\n";

		await mkdir(brainPath, { recursive: true });
		await writeFile(join(brainPath, "CLAUDE.md"), driftedContent, "utf-8");

		const results = await provisionBrain(brainPath, mcpPath);
		const claudeStep = results[2];

		expect(claudeStep.status).toBe("exists");
		expect(claudeStep.content).toBeUndefined();
	});

	it("vault CLAUDE.md missing returns would-create with content", async () => {
		const brainPath = makeBrainPath();
		const mcpPath = makeMcpPath();

		// Vault exists but CLAUDE.md is absent
		await mkdir(join(brainPath, ".obsidian"), { recursive: true });

		const results = await provisionBrain(brainPath, mcpPath);
		const claudeStep = results[2];

		expect(claudeStep.status).toBe("would-create");
		expect(claudeStep.content).toBeTruthy();
	});

	// -------------------------------------------------------------------------
	// Negative assertion: no brain seed step ever returns would-overwrite
	// -------------------------------------------------------------------------
	// Spec trace:
	//   outcomes.undesired — "The coding-playbook hub or vault-root CLAUDE.md being returned with
	//     status: 'would-overwrite' under any circumstance — even when on-disk bytes have drifted
	//     from the bundled template."

	describe.each([
		{
			scenario: "file absent",
			setup: async (_brainPath: string) => {
				// nothing — neither file is written
			},
		},
		{
			scenario: "byte-identical to template",
			setup: async (brainPath: string) => {
				const firstResults = await provisionBrain(brainPath, makeMcpPath());
				const canonicalHub = firstResults[1].content!;
				const canonicalClaudeMd = firstResults[2].content!;
				await mkdir(join(brainPath, "coding-playbook"), { recursive: true });
				await writeFile(join(brainPath, "coding-playbook", "coding-playbook.md"), canonicalHub, "utf-8");
				await writeFile(join(brainPath, "CLAUDE.md"), canonicalClaudeMd, "utf-8");
			},
		},
		{
			scenario: "drifted from template",
			setup: async (brainPath: string) => {
				const firstResults = await provisionBrain(brainPath, makeMcpPath());
				const driftedHub = firstResults[1].content! + "\n## Extra Section\n\nUnexpected drift.\n";
				const driftedClaudeMd = firstResults[2].content! + "\n## Extra\n\nDrifted content.\n";
				await mkdir(join(brainPath, "coding-playbook"), { recursive: true });
				await writeFile(join(brainPath, "coding-playbook", "coding-playbook.md"), driftedHub, "utf-8");
				await writeFile(join(brainPath, "CLAUDE.md"), driftedClaudeMd, "utf-8");
			},
		},
		{
			scenario: "completely replaced with unrelated content",
			setup: async (brainPath: string) => {
				await mkdir(join(brainPath, "coding-playbook"), { recursive: true });
				await writeFile(
					join(brainPath, "coding-playbook", "coding-playbook.md"),
					"# My curated notes\n\nTotally different content.\n",
					"utf-8",
				);
				await writeFile(join(brainPath, "CLAUDE.md"), "# My curated notes\n\nTotally different content.\n", "utf-8");
			},
		},
	])(
		"provisionBrain never returns would-overwrite for playbook hub or vault CLAUDE.md under any on-disk state [$scenario]",
		({ setup }) => {
			it("playbook hub (results[1]) status is exists or would-create, never would-overwrite", async () => {
				const brainPath = makeBrainPath();
				const mcpPath = makeMcpPath();
				await setup(brainPath);

				const results = await provisionBrain(brainPath, mcpPath);
				const hubStep = results[1];

				expect(["exists", "would-create"]).toContain(hubStep.status);
				expect(hubStep.status).not.toBe("would-overwrite");
			});

			it("vault CLAUDE.md (results[2]) status is exists or would-create, never would-overwrite", async () => {
				const brainPath = makeBrainPath();
				const mcpPath = makeMcpPath();
				await setup(brainPath);

				const results = await provisionBrain(brainPath, mcpPath);
				const claudeStep = results[2];

				expect(["exists", "would-create"]).toContain(claudeStep.status);
				expect(claudeStep.status).not.toBe("would-overwrite");
			});
		},
	);

	it("is idempotent — second call with fully provisioned vault returns all exists", async () => {
		const brainPath = makeBrainPath();
		const mcpPath = makeMcpPath();

		// First pass: get canonical template content for the file steps
		const firstResults = await provisionBrain(brainPath, mcpPath);
		const canonicalHub = firstResults[1].content!;
		const canonicalClaudeMd = firstResults[2].content!;

		// Simulate fully provisioned state using canonical template bytes
		await mkdir(join(brainPath, ".obsidian"), { recursive: true });
		await mkdir(join(brainPath, "coding-playbook"), { recursive: true });
		await writeFile(join(brainPath, "coding-playbook", "coding-playbook.md"), canonicalHub, "utf-8");
		await writeFile(join(brainPath, "CLAUDE.md"), canonicalClaudeMd, "utf-8");
		const existing = { mcpServers: { obsidian: expectedObsidianEntry(brainPath) } };
		await writeFile(mcpPath, JSON.stringify(existing), "utf-8");

		const results = await provisionBrain(brainPath, mcpPath);

		expect(results[0].status).toBe("exists");
		expect(results[1].status).toBe("exists");
		expect(results[2].status).toBe("exists");
		expect(results[3].status).toBe("exists");
	});
});
