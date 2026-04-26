/**
 * invariant(5g): The `obsidianMcpEntry` export was removed from `./index.ts` in
 * Step 4 of the provisionBrain plan. This test file intentionally does NOT import
 * `{ obsidianMcpEntry }` from `"./index.js"`. Any future attempt to add that import
 * will fail at compile time (TypeScript: "has no exported member 'obsidianMcpEntry'")
 * and at runtime (undefined). This comment is the spec-enforceable boundary: the
 * provisionBrain module must never re-export obsidianMcpEntry.
 *
 * invariant(this cycle): the inline constants `PLAYBOOK_HUB_TEMPLATE` and
 * `VAULT_CLAUDE_MD_TEMPLATE` were removed from `./index.ts`. Hub artifact bytes now
 * flow through `parseBrainAide` / `parseBrainAideFromString` from the scaffolded
 * brain.aide's body sections. Any future attempt to re-introduce a hub-bytes constant
 * in this module is a regression.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

// Mock node:os so platform-dependent tests can control the platform value.
vi.mock("node:os", async (importOriginal) => {
	const actual = await importOriginal<typeof import("node:os")>();
	return { ...actual, platform: vi.fn(() => actual.platform()) };
});

import { platform } from "node:os";
import provisionBrain from "./index.js";
import obsidianBrainAideTemplate from "./obsidianBrainAideTemplate/index.js";
import { parseBrainAideFromString, interpolateArgs } from "@/service/parseBrainAide/index.js";

const mockPlatform = vi.mocked(platform);

let tempDir: string;

beforeEach(async () => {
	tempDir = await mkdtemp(join(tmpdir(), "aide-provision-brain-"));
	// Reset to host platform by default; individual tests override as needed.
	vi.mocked(platform).mockReturnValue(process.platform as ReturnType<typeof platform>);
});

afterEach(async () => {
	await rm(tempDir, { recursive: true, force: true });
	vi.restoreAllMocks();
});

/** Returns the project root for the current test (host project, not brain). */
function makeProjectRoot(): string {
	return tempDir;
}

/** Returns the brain root path for the current test. */
function makeBrainPath(): string {
	return join(tempDir, "brain");
}

/** Returns the .mcp.json path for the current test. */
function makeMcpPath(): string {
	return join(tempDir, ".mcp.json");
}

describe("provisionBrain", () => {
	// -----------------------------------------------------------------------
	// 5a. Cold install scaffolds brain.aide
	// -----------------------------------------------------------------------

	it("5a: cold install — Brain config step is would-create with parseable content", async () => {
		const projectRoot = makeProjectRoot();
		const brainPath = makeBrainPath();
		const mcpPath = makeMcpPath();

		const results = await provisionBrain(projectRoot, brainPath, mcpPath);

		// Five steps returned in order.
		expect(results).toHaveLength(5);
		expect(results[0].name).toBe("Brain config (brain.aide)");
		expect(results[1].name).toBe("Brain root directories");
		expect(results[2].name).toBe("Playbook hub");
		expect(results[3].name).toBe("Research hub");
		expect(results[4].name).toBe("MCP config (brain)");

		// Brain config step is would-create with content.
		const brainAideStep = results[0];
		expect(brainAideStep.status).toBe("would-create");
		expect(brainAideStep.category).toBe("brain");
		expect(brainAideStep.filePath).toBe(join(projectRoot, ".aide", "config", "brain.aide"));
		expect(brainAideStep.content).toBeTruthy();

		// Content must be parseable by parseBrainAideFromString.
		const parsed = parseBrainAideFromString(brainAideStep.content!);
		expect(parsed.kind).toBe("ok");
	});

	// -----------------------------------------------------------------------
	// 4b. Cold-install: hub artifacts source content from scaffolded brain.aide
	// -----------------------------------------------------------------------

	describe("Cold-install: hub artifacts source content from scaffolded brain.aide", () => {
		it("playbook hub content matches the ## Playbook hub section from the bundled template", async () => {
			const projectRoot = makeProjectRoot();
			const brainPath = makeBrainPath();
			const mcpPath = makeMcpPath();

			const results = await provisionBrain(projectRoot, brainPath, mcpPath);
			const playbookHubStep = results[2];

			// Derive expected bytes from the bundled template — NOT from an inline constant.
			const template = obsidianBrainAideTemplate(brainPath);
			const parsed = parseBrainAideFromString(template);
			expect(parsed.kind).toBe("ok");
			if (parsed.kind !== "ok") return;
			const expectedPlaybookHub = parsed.playbookHub;

			expect(playbookHubStep.status).toBe("would-create");
			expect(playbookHubStep.content).toBe(expectedPlaybookHub);

			// The bytes have a non-trivial source — proves they flowed through the parser.
			expect(playbookHubStep.content).toBeTruthy();
		});

		it("research hub content matches the ## Research hub section from the bundled template", async () => {
			const projectRoot = makeProjectRoot();
			const brainPath = makeBrainPath();
			const mcpPath = makeMcpPath();

			const results = await provisionBrain(projectRoot, brainPath, mcpPath);
			const researchHubStep = results[3];

			// Derive expected bytes from the bundled template — NOT from an inline constant.
			const template = obsidianBrainAideTemplate(brainPath);
			const parsed = parseBrainAideFromString(template);
			expect(parsed.kind).toBe("ok");
			if (parsed.kind !== "ok") return;
			const expectedResearchHub = parsed.researchHub;

			expect(researchHubStep.status).toBe("would-create");
			expect(researchHubStep.content).toBe(expectedResearchHub);

			// The bytes have a non-trivial source — proves they flowed through the parser.
			expect(researchHubStep.content).toBeTruthy();
		});
	});

	// -----------------------------------------------------------------------
	// 4c. Existing brain.aide: hub artifacts source from on-disk file
	// -----------------------------------------------------------------------

	describe("Existing brain.aide: hub artifacts source from on-disk file", () => {
		it("playbook hub content reflects user's ## Playbook hub edits in brain.aide", async () => {
			const projectRoot = makeProjectRoot();
			const brainPath = makeBrainPath();
			const mcpPath = makeMcpPath();

			// Pre-write a brain.aide with custom sentinel strings in both hub sections.
			const aideConfigDir = join(projectRoot, ".aide", "config");
			await mkdir(aideConfigDir, { recursive: true });
			const customContent = [
				"---",
				"name: obsidian",
				"mcpServerConfig:",
				"  command: npx",
				"  args:",
				`    - '@bitbonsai/mcpvault'`,
				`    - '${brainPath}'`,
				"---",
				"",
				"## Prose",
				"",
				"Prose content here.",
				"",
				"## Playbook hub",
				"",
				"# USER-EDITED-PLAYBOOK",
				"",
				"User customized this section.",
				"",
				"## Research hub",
				"",
				"# USER-EDITED-RESEARCH",
				"",
				"User customized this section.",
			].join("\n");
			await writeFile(join(aideConfigDir, "brain.aide"), customContent, "utf-8");

			const results = await provisionBrain(projectRoot, brainPath, mcpPath);
			const playbookHubStep = results[2];

			expect(playbookHubStep.status).toBe("would-create");
			expect(playbookHubStep.content).toContain("USER-EDITED-PLAYBOOK");
		});

		it("research hub content reflects user's ## Research hub edits in brain.aide", async () => {
			const projectRoot = makeProjectRoot();
			const brainPath = makeBrainPath();
			const mcpPath = makeMcpPath();

			// Pre-write a brain.aide with custom sentinel strings in both hub sections.
			const aideConfigDir = join(projectRoot, ".aide", "config");
			await mkdir(aideConfigDir, { recursive: true });
			const customContent = [
				"---",
				"name: obsidian",
				"mcpServerConfig:",
				"  command: npx",
				"  args:",
				`    - '@bitbonsai/mcpvault'`,
				`    - '${brainPath}'`,
				"---",
				"",
				"## Prose",
				"",
				"Prose content here.",
				"",
				"## Playbook hub",
				"",
				"# USER-EDITED-PLAYBOOK",
				"",
				"User customized this section.",
				"",
				"## Research hub",
				"",
				"# USER-EDITED-RESEARCH",
				"",
				"User customized this section.",
			].join("\n");
			await writeFile(join(aideConfigDir, "brain.aide"), customContent, "utf-8");

			const results = await provisionBrain(projectRoot, brainPath, mcpPath);
			const researchHubStep = results[3];

			expect(researchHubStep.status).toBe("would-create");
			expect(researchHubStep.content).toContain("USER-EDITED-RESEARCH");
		});
	});

	// -----------------------------------------------------------------------
	// 4d. Malformed brain.aide: hub steps surface as would-skip
	// -----------------------------------------------------------------------

	describe("Malformed brain.aide: hub steps surface as would-skip", () => {
		it("playbook hub and research hub surface would-skip when brain.aide body is missing the hub sections", async () => {
			const projectRoot = makeProjectRoot();
			const brainPath = makeBrainPath();
			const mcpPath = makeMcpPath();

			// Pre-write brain.aide with valid frontmatter but body missing ## Playbook hub
			// and ## Research hub — only ## Prose. This triggers malformed-body from the parser.
			const aideConfigDir = join(projectRoot, ".aide", "config");
			await mkdir(aideConfigDir, { recursive: true });
			const malformedContent = [
				"---",
				"name: obsidian",
				"mcpServerConfig:",
				"  command: npx",
				"  args:",
				`    - '@bitbonsai/mcpvault'`,
				`    - '${brainPath}'`,
				"---",
				"",
				"## Prose",
				"",
				"Only prose — hub sections are missing so the parser returns malformed-body.",
			].join("\n");
			await writeFile(join(aideConfigDir, "brain.aide"), malformedContent, "utf-8");

			const results = await provisionBrain(projectRoot, brainPath, mcpPath);

			const playbookHubStep = results[2];
			const researchHubStep = results[3];

			// Hub steps must be would-skip when the body is malformed.
			expect(playbookHubStep.status).toBe("would-skip");
			expect(researchHubStep.status).toBe("would-skip");

			// Both must carry an actionable instructions field.
			expect(playbookHubStep.instructions).toBeTruthy();
			expect(researchHubStep.instructions).toBeTruthy();

			// brain.aide step: file is on disk, so the presence check passes.
			// The brain config step does NOT validate body — only presence.
			const brainAideStep = results[0];
			expect(brainAideStep.status).toBe("exists");

			// MCP step: frontmatter is still valid, so the prescription is derivable.
			const mcpStep = results[4];
			expect(mcpStep.name).toBe("MCP config (brain)");
			expect(mcpStep.prescription).toBeDefined();
		});
	});

	// -----------------------------------------------------------------------
	// 5b. Existing brain.aide stays untouched
	// -----------------------------------------------------------------------

	it("5b: existing brain.aide — Brain config step is exists with no content field", async () => {
		const projectRoot = makeProjectRoot();
		const brainPath = makeBrainPath();
		const mcpPath = makeMcpPath();

		// Pre-write a brain.aide so the step sees it on disk.
		// Use the bundled template so the body carries all three sections.
		const aideConfigDir = join(projectRoot, ".aide", "config");
		await mkdir(aideConfigDir, { recursive: true });
		await writeFile(
			join(aideConfigDir, "brain.aide"),
			obsidianBrainAideTemplate(brainPath),
			"utf-8",
		);

		const results = await provisionBrain(projectRoot, brainPath, mcpPath);

		const brainAideStep = results[0];
		expect(brainAideStep.name).toBe("Brain config (brain.aide)");
		expect(brainAideStep.status).toBe("exists");
		expect(brainAideStep.content).toBeUndefined();
	});

	// -----------------------------------------------------------------------
	// 5c. MCP step derives from scaffolded brain.aide on cold install
	// -----------------------------------------------------------------------

	it("5c (win32): cold install — MCP entry derived from template args on Windows", async () => {
		mockPlatform.mockReturnValue("win32");

		const projectRoot = makeProjectRoot();
		const brainPath = makeBrainPath();
		const mcpPath = makeMcpPath();

		const results = await provisionBrain(projectRoot, brainPath, mcpPath);

		// On cold install, the template bytes drive the derivation.
		const templateContent = obsidianBrainAideTemplate(brainPath);
		const parsed = parseBrainAideFromString(templateContent);
		expect(parsed.kind).toBe("ok");
		if (parsed.kind !== "ok") return; // narrow for TypeScript

		const expectedArgs = interpolateArgs(parsed.config);
		const expectedEntry = {
			command: parsed.config.mcpServerConfig.command,
			args: expectedArgs,
		};

		const mcpStep = results[4];
		expect(mcpStep.name).toBe("MCP config (brain)");
		expect(mcpStep.prescription?.entry).toEqual(expectedEntry);

		// Windows-specific shape: cmd /c npx @bitbonsai/mcpvault <brainPath>
		expect(mcpStep.prescription?.entry.command).toBe("cmd");
		expect(mcpStep.prescription?.entry.args).toEqual(["/c", "npx", "@bitbonsai/mcpvault", brainPath]);
	});

	it("5c (posix): cold install — MCP entry derived from template args on POSIX", async () => {
		mockPlatform.mockReturnValue("linux");

		const projectRoot = makeProjectRoot();
		const brainPath = makeBrainPath();
		const mcpPath = makeMcpPath();

		const results = await provisionBrain(projectRoot, brainPath, mcpPath);

		const templateContent = obsidianBrainAideTemplate(brainPath);
		const parsed = parseBrainAideFromString(templateContent);
		expect(parsed.kind).toBe("ok");
		if (parsed.kind !== "ok") return;

		const expectedArgs = interpolateArgs(parsed.config);
		const expectedEntry = {
			command: parsed.config.mcpServerConfig.command,
			args: expectedArgs,
		};

		const mcpStep = results[4];
		expect(mcpStep.prescription?.entry).toEqual(expectedEntry);

		// POSIX shape: npx @bitbonsai/mcpvault <brainPath>
		expect(mcpStep.prescription?.entry.command).toBe("npx");
		expect(mcpStep.prescription?.entry.args).toEqual(["@bitbonsai/mcpvault", brainPath]);
	});

	// -----------------------------------------------------------------------
	// 5d. MCP step derives from existing brain.aide (source-of-truth test)
	// -----------------------------------------------------------------------

	it("5d: existing brain.aide with custom args — MCP entry reflects user's config, not canonical template", async () => {
		const projectRoot = makeProjectRoot();
		const brainPath = makeBrainPath();
		const mcpPath = makeMcpPath();

		// User has customized their brain.aide with the new minimal schema.
		// Fixture grows two new hub sections so the parser succeeds on the body.
		const customBrainAide = [
			"---",
			"name: obsidian",
			"mcpServerConfig:",
			"  command: node",
			"  args:",
			'    - "/custom/path/to/launcher.js"',
			`    - ${brainPath}`,
			"---",
			"",
			"## Prose",
			"",
			"Custom user prose.",
			"",
			"## Playbook hub",
			"",
			"# Custom Playbook",
			"",
			"## Research hub",
			"",
			"# Custom Research",
		].join("\n");

		const aideConfigDir = join(projectRoot, ".aide", "config");
		await mkdir(aideConfigDir, { recursive: true });
		await writeFile(join(aideConfigDir, "brain.aide"), customBrainAide, "utf-8");

		const results = await provisionBrain(projectRoot, brainPath, mcpPath);

		const mcpStep = results[4];
		// Must use user's custom command and args, NOT the canonical Obsidian template.
		expect(mcpStep.prescription?.entry.command).toBe("node");
		expect(mcpStep.prescription?.entry.args).toEqual(["/custom/path/to/launcher.js", brainPath]);

		// Confirm it does NOT match the canonical template.
		const templateParsed = parseBrainAideFromString(obsidianBrainAideTemplate(brainPath));
		if (templateParsed.kind !== "ok") return;
		expect(mcpStep.prescription?.entry.command).not.toBe(templateParsed.config.mcpServerConfig.command);
	});

	// -----------------------------------------------------------------------
	// 5e. Legacy obsidian-key migration
	// -----------------------------------------------------------------------

	it("5e: legacy obsidian-only .mcp.json — MCP step is would-overwrite with key brain", async () => {
		const projectRoot = makeProjectRoot();
		const brainPath = makeBrainPath();
		const mcpPath = makeMcpPath();

		const legacyEntry = { command: "npx", args: ["-y", "obsidian-mcp", brainPath] };
		await writeFile(
			mcpPath,
			JSON.stringify({ mcpServers: { obsidian: legacyEntry } }),
			"utf-8",
		);

		const results = await provisionBrain(projectRoot, brainPath, mcpPath);

		const mcpStep = results[4];
		expect(mcpStep.name).toBe("MCP config (brain)");
		expect(mcpStep.status).toBe("would-overwrite");
		expect(mcpStep.prescription?.key).toBe("brain");
	});

	// -----------------------------------------------------------------------
	// 5f. Full idempotency — all five steps return exists
	// -----------------------------------------------------------------------

	it("5f: fully provisioned project — all five steps return exists", async () => {
		// Must mock a deterministic platform so template bytes are stable.
		mockPlatform.mockReturnValue("linux");

		const projectRoot = makeProjectRoot();
		const brainPath = makeBrainPath();
		const mcpPath = makeMcpPath();

		// Brain config file.
		const brainAideContent = obsidianBrainAideTemplate(brainPath);
		const aideConfigDir = join(projectRoot, ".aide", "config");
		await mkdir(aideConfigDir, { recursive: true });
		await writeFile(join(aideConfigDir, "brain.aide"), brainAideContent, "utf-8");

		// Brain root: non-empty directory (has .obsidian/).
		await mkdir(join(brainPath, ".obsidian"), { recursive: true });

		// Playbook hub.
		await mkdir(join(brainPath, "coding-playbook"), { recursive: true });
		await writeFile(
			join(brainPath, "coding-playbook", "coding-playbook.md"),
			"# Coding Playbook\n",
			"utf-8",
		);

		// Research hub.
		await mkdir(join(brainPath, "research"), { recursive: true });
		await writeFile(
			join(brainPath, "research", "research.md"),
			"# Research\n",
			"utf-8",
		);

		// .mcp.json with the derived brain entry.
		const parsed = parseBrainAideFromString(brainAideContent);
		expect(parsed.kind).toBe("ok");
		if (parsed.kind !== "ok") return;
		const derivedEntry = {
			command: parsed.config.mcpServerConfig.command,
			args: interpolateArgs(parsed.config),
		};
		await writeFile(
			mcpPath,
			JSON.stringify({ mcpServers: { brain: derivedEntry } }),
			"utf-8",
		);

		const results = await provisionBrain(projectRoot, brainPath, mcpPath);

		expect(results).toHaveLength(5);
		expect(results[0].status).toBe("exists"); // Brain config
		expect(results[1].status).toBe("exists"); // Brain root directories
		expect(results[2].status).toBe("exists"); // Playbook hub
		expect(results[3].status).toBe("exists"); // Research hub
		expect(results[4].status).toBe("exists"); // MCP config
	});

	// -----------------------------------------------------------------------
	// 5h. brain.aide schema does NOT include intent-spec or deprecated fields
	// -----------------------------------------------------------------------

	it("5h: scaffolded brain.aide has no scope, outcomes, status, deprecated, and only contains name and mcpServerConfig", async () => {
		mockPlatform.mockReturnValue("linux");

		const projectRoot = makeProjectRoot();
		const brainPath = makeBrainPath();

		// Get the template content as it would be written on a cold install.
		const templateContent = obsidianBrainAideTemplate(brainPath);
		const parsed = parseBrainAideFromString(templateContent);

		expect(parsed.kind).toBe("ok");
		if (parsed.kind !== "ok") return;

		// The config object must NOT contain intent-spec frontmatter fields.
		// Enforces outcomes.undesired[5]: "no scope, no outcomes, no intent, no status lifecycle field."
		const config = parsed.config as Record<string, unknown>;
		expect(config).not.toHaveProperty("scope");
		expect(config).not.toHaveProperty("outcomes");
		expect(config).not.toHaveProperty("status");
		expect(config).not.toHaveProperty("intent");

		// The config must NOT contain deprecated fields — the parser rejects them, but
		// verify at the structural level too as an extra regression anchor.
		expect(config).not.toHaveProperty("connector");
		expect(config).not.toHaveProperty("rootPath");
		expect(config).not.toHaveProperty("entryFile");
		expect(config).not.toHaveProperty("tools");

		// The raw template bytes also must not contain those keys anywhere in the frontmatter.
		// Extract frontmatter block for a targeted check.
		// The frontmatter is isolated by the first `---\n` open and the first `\n---\n` close.
		const fenceStart = templateContent.indexOf("---\n");
		const fenceEnd = templateContent.indexOf("\n---\n", fenceStart + 3);
		const frontmatterBlock = templateContent.slice(fenceStart, fenceEnd);

		// Intent-spec fields must be absent.
		expect(frontmatterBlock).not.toContain("scope:");
		expect(frontmatterBlock).not.toContain("outcomes:");
		expect(frontmatterBlock).not.toContain("status:");
		expect(frontmatterBlock).not.toContain("intent:");

		// Deprecated fields must be absent.
		expect(frontmatterBlock).not.toContain("connector:");
		expect(frontmatterBlock).not.toContain("rootPath:");
		expect(frontmatterBlock).not.toContain("entryFile:");
		expect(frontmatterBlock).not.toContain("tools:");

		// Required minimal-schema fields must be present.
		expect(frontmatterBlock).toContain("name:");
		expect(frontmatterBlock).toContain("mcpServerConfig:");
	});

	// -----------------------------------------------------------------------
	// Regression: existing behaviours preserved from prior test suite
	// -----------------------------------------------------------------------

	it("brain root directories step is would-create with expected directory list", async () => {
		const projectRoot = makeProjectRoot();
		const brainPath = makeBrainPath();
		const mcpPath = makeMcpPath();

		const results = await provisionBrain(projectRoot, brainPath, mcpPath);

		const brainRootStep = results[1];
		expect(brainRootStep.status).toBe("would-create");
		expect(brainRootStep.category).toBe("brain");
		expect(brainRootStep.content).toBeTruthy();
		const dirs = JSON.parse(brainRootStep.content!);
		expect(Array.isArray(dirs)).toBe(true);
		expect(dirs).toContain("research");
		expect(dirs).toContain("coding-playbook");
	});

	it("brain root is fully populated when .obsidian dir is present", async () => {
		const projectRoot = makeProjectRoot();
		const brainPath = makeBrainPath();
		const mcpPath = makeMcpPath();
		await mkdir(join(brainPath, ".obsidian"), { recursive: true });

		const results = await provisionBrain(projectRoot, brainPath, mcpPath);

		expect(results[1].status).toBe("exists");
		expect(results[1].content).toBeUndefined();
	});

	it("brain root is fully populated when directory is non-empty", async () => {
		const projectRoot = makeProjectRoot();
		const brainPath = makeBrainPath();
		const mcpPath = makeMcpPath();
		await mkdir(brainPath, { recursive: true });
		await writeFile(join(brainPath, "notes.md"), "# Notes", "utf-8");

		const results = await provisionBrain(projectRoot, brainPath, mcpPath);

		expect(results[1].status).toBe("exists");
	});

	it("playbook hub is would-create with Markdown hub content", async () => {
		const projectRoot = makeProjectRoot();
		const brainPath = makeBrainPath();
		const mcpPath = makeMcpPath();

		const results = await provisionBrain(projectRoot, brainPath, mcpPath);
		const hubStep = results[2];

		expect(hubStep.name).toBe("Playbook hub");
		expect(hubStep.status).toBe("would-create");
		expect(hubStep.content).toBeTruthy();
	});

	it("playbook hub returns exists when file is present (seed-semantic — no byte comparison)", async () => {
		const projectRoot = makeProjectRoot();
		const brainPath = makeBrainPath();
		const mcpPath = makeMcpPath();
		await mkdir(join(brainPath, "coding-playbook"), { recursive: true });
		await writeFile(
			join(brainPath, "coding-playbook", "coding-playbook.md"),
			"# Totally different content\n\nUser modified this.\n",
			"utf-8",
		);

		const results = await provisionBrain(projectRoot, brainPath, mcpPath);

		expect(results[2].status).toBe("exists");
		expect(results[2].content).toBeUndefined();
	});

	it("research hub is would-create with Markdown hub content", async () => {
		const projectRoot = makeProjectRoot();
		const brainPath = makeBrainPath();
		const mcpPath = makeMcpPath();

		const results = await provisionBrain(projectRoot, brainPath, mcpPath);
		const hubStep = results[3];

		expect(hubStep.name).toBe("Research hub");
		expect(hubStep.status).toBe("would-create");
		expect(hubStep.content).toBeTruthy();
	});

	it("research hub returns exists when file is present (seed-semantic — no byte comparison)", async () => {
		const projectRoot = makeProjectRoot();
		const brainPath = makeBrainPath();
		const mcpPath = makeMcpPath();
		await mkdir(join(brainPath, "research"), { recursive: true });
		await writeFile(
			join(brainPath, "research", "research.md"),
			"# User's Research\n\nUser modified this.\n",
			"utf-8",
		);

		const results = await provisionBrain(projectRoot, brainPath, mcpPath);

		expect(results[3].status).toBe("exists");
		expect(results[3].content).toBeUndefined();
	});

	it("cold install (no brain, no obsidian key in existing .mcp.json) yields would-create with key brain", async () => {
		const projectRoot = makeProjectRoot();
		const brainPath = makeBrainPath();
		const mcpPath = makeMcpPath();
		await writeFile(mcpPath, JSON.stringify({ mcpServers: {} }), "utf-8");

		const results = await provisionBrain(projectRoot, brainPath, mcpPath);

		const mcpStep = results[4];
		expect(mcpStep.status).toBe("would-create");
		expect(mcpStep.prescription?.key).toBe("brain");
	});

	// -----------------------------------------------------------------------
	// 5g. Brain key present but entry differs (drift) — would-overwrite
	// -----------------------------------------------------------------------

	it("5g: brain key present with drifted entry — MCP step is would-overwrite with prescription matching brain.aide", async () => {
		mockPlatform.mockReturnValue("linux");

		const projectRoot = makeProjectRoot();
		const brainPath = makeBrainPath();
		const mcpPath = makeMcpPath();

		// Pre-write a valid brain.aide using the bundled template.
		const brainAideContent = obsidianBrainAideTemplate(brainPath);
		const aideConfigDir = join(projectRoot, ".aide", "config");
		await mkdir(aideConfigDir, { recursive: true });
		await writeFile(join(aideConfigDir, "brain.aide"), brainAideContent, "utf-8");

		// Pre-write a .mcp.json whose brain entry deliberately differs from what
		// brain.aide derives — simulates a drift state (user edited brain.aide after
		// the last install, so the on-disk MCP entry is stale).
		const driftedEntry = { command: "node", args: ["/old/launcher.js", "/old/brain-path"] };
		await writeFile(
			mcpPath,
			JSON.stringify({ mcpServers: { brain: driftedEntry } }),
			"utf-8",
		);

		const results = await provisionBrain(projectRoot, brainPath, mcpPath);

		const mcpStep = results[4];
		expect(mcpStep.name).toBe("MCP config (brain)");
		// Drift branch must return would-overwrite (not exists).
		expect(mcpStep.status).toBe("would-overwrite");
		expect(mcpStep.prescription?.key).toBe("brain");

		// The prescription must match brain.aide's derived entry, NOT the on-disk drifted one.
		const parsed = parseBrainAideFromString(brainAideContent);
		expect(parsed.kind).toBe("ok");
		if (parsed.kind !== "ok") return;
		const expectedEntry = {
			command: parsed.config.mcpServerConfig.command,
			args: interpolateArgs(parsed.config),
		};
		expect(mcpStep.prescription?.entry).toEqual(expectedEntry);

		// Sanity: the prescription must NOT equal the drifted on-disk entry.
		expect(mcpStep.prescription?.entry.command).not.toBe(driftedEntry.command);
		expect(mcpStep.prescription?.entry.args).not.toEqual(driftedEntry.args);
	});

	it("transitional install (both brain and obsidian keys) yields would-overwrite with key brain", async () => {
		mockPlatform.mockReturnValue("linux");

		const projectRoot = makeProjectRoot();
		const brainPath = makeBrainPath();
		const mcpPath = makeMcpPath();
		const entry = { command: "npx", args: ["-y", "obsidian-mcp", brainPath] };
		await writeFile(
			mcpPath,
			JSON.stringify({ mcpServers: { obsidian: entry, brain: entry } }),
			"utf-8",
		);

		const results = await provisionBrain(projectRoot, brainPath, mcpPath);

		const mcpStep = results[4];
		expect(mcpStep.status).toBe("would-overwrite");
		expect(mcpStep.prescription?.key).toBe("brain");
	});

	it("malformed .mcp.json yields would-create with configMalformed: true", async () => {
		const projectRoot = makeProjectRoot();
		const brainPath = makeBrainPath();
		const mcpPath = makeMcpPath();
		await writeFile(mcpPath, "not valid json {{{", "utf-8");

		const results = await provisionBrain(projectRoot, brainPath, mcpPath);

		const mcpStep = results[4];
		expect(mcpStep.status).toBe("would-create");
		expect(mcpStep.configMalformed).toBe(true);
		expect(mcpStep.prescription).toBeDefined();
	});

	it("never writes to disk", async () => {
		const projectRoot = makeProjectRoot();
		const brainPath = makeBrainPath();
		const mcpPath = makeMcpPath();

		await provisionBrain(projectRoot, brainPath, mcpPath);

		const { access } = await import("node:fs/promises");
		await expect(access(brainPath)).rejects.toThrow();
		await expect(access(join(brainPath, "coding-playbook", "coding-playbook.md"))).rejects.toThrow();
		await expect(access(join(brainPath, "research", "research.md"))).rejects.toThrow();
		await expect(access(mcpPath)).rejects.toThrow();
		// brain.aide must NOT be written either.
		await expect(access(join(projectRoot, ".aide", "config", "brain.aide"))).rejects.toThrow();
	});

	// -----------------------------------------------------------------------
	// Negative: seed files never return would-overwrite
	// -----------------------------------------------------------------------

	describe.each([
		{
			scenario: "file absent",
			setup: async (_projectRoot: string, _brainPath: string) => {
				// nothing
			},
		},
		{
			scenario: "user-modified content",
			setup: async (_projectRoot: string, brainPath: string) => {
				await mkdir(join(brainPath, "coding-playbook"), { recursive: true });
				await writeFile(
					join(brainPath, "coding-playbook", "coding-playbook.md"),
					"# My curated notes\n",
					"utf-8",
				);
				await mkdir(join(brainPath, "research"), { recursive: true });
				await writeFile(
					join(brainPath, "research", "research.md"),
					"# My custom research\n",
					"utf-8",
				);
			},
		},
	])(
		"seed files never would-overwrite [$scenario]",
		({ setup }) => {
			it("playbook hub status is never would-overwrite", async () => {
				const projectRoot = makeProjectRoot();
				const brainPath = makeBrainPath();
				const mcpPath = makeMcpPath();
				await setup(projectRoot, brainPath);

				const results = await provisionBrain(projectRoot, brainPath, mcpPath);

				expect(results[2].status).not.toBe("would-overwrite");
			});

			it("research hub status is never would-overwrite", async () => {
				const projectRoot = makeProjectRoot();
				const brainPath = makeBrainPath();
				const mcpPath = makeMcpPath();
				await setup(projectRoot, brainPath);

				const results = await provisionBrain(projectRoot, brainPath, mcpPath);

				expect(results[3].status).not.toBe("would-overwrite");
			});

			it("brain.aide config status is never would-overwrite", async () => {
				const projectRoot = makeProjectRoot();
				const brainPath = makeBrainPath();
				const mcpPath = makeMcpPath();
				await setup(projectRoot, brainPath);

				const results = await provisionBrain(projectRoot, brainPath, mcpPath);

				expect(results[0].status).not.toBe("would-overwrite");
			});
		},
	);
});
