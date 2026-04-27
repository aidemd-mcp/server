/**
 * invariant(5g): The `obsidianMcpEntry` export was removed from `./index.ts` in
 * Step 4 of the provisionBrain plan. This test file intentionally does NOT import
 * `{ obsidianMcpEntry }` from `"./index.js"`. Any future attempt to add that import
 * will fail at compile time (TypeScript: "has no exported member 'obsidianMcpEntry'")
 * and at runtime (undefined). This comment is the spec-enforceable boundary: the
 * provisionBrain module must never re-export obsidianMcpEntry.
 *
 * invariant(this cycle): Entry-point artifact bytes flow through `parseBrainAide` /
 * `parseBrainAideFromString` from the scaffolded brain.aide's marker-pair body sections
 * (`playbook` and `research` typed fields). Any future attempt to re-introduce an
 * entry-point bytes constant in this module is a regression.
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

		// Six steps returned in order.
		expect(results).toHaveLength(6);
		expect(results[0].name).toBe("Brain config (brain.aide)");
		expect(results[1].name).toBe("Brain root directories");
		expect(results[2].name).toBe("Playbook entry-point");
		expect(results[3].name).toBe("Study-playbook entry-point");
		expect(results[4].name).toBe("Research entry-point");
		expect(results[5].name).toBe("MCP config (brain)");

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
	// 4b. Cold-install: entry-point artifacts source content from scaffolded brain.aide
	// -----------------------------------------------------------------------

	describe("Cold-install: entry-point artifacts source content from scaffolded brain.aide", () => {
		it("playbook content matches the playbook body section between `<!-- aide-playbook-start -->` and `<!-- aide-playbook-end -->` from the bundled template", async () => {
			const projectRoot = makeProjectRoot();
			const brainPath = makeBrainPath();
			const mcpPath = makeMcpPath();

			const results = await provisionBrain(projectRoot, brainPath, mcpPath);
			const playbookStep = results[2];

			// Derive expected bytes from the bundled template — NOT from an inline constant.
			const template = obsidianBrainAideTemplate(brainPath);
			const parsed = parseBrainAideFromString(template);
			expect(parsed.kind).toBe("ok");
			if (parsed.kind !== "ok") return;
			const expectedPlaybook = parsed.playbook;

			expect(playbookStep.status).toBe("would-create");
			expect(playbookStep.content).toBe(expectedPlaybook);

			// The bytes have a non-trivial source — proves they flowed through the parser.
			expect(playbookStep.content).toBeTruthy();
		});

		it("studyPlaybook content matches the studyPlaybook body section between `<!-- aide-study-playbook-start -->` and `<!-- aide-study-playbook-end -->` from the bundled template", async () => {
			const projectRoot = makeProjectRoot();
			const brainPath = makeBrainPath();
			const mcpPath = makeMcpPath();

			const results = await provisionBrain(projectRoot, brainPath, mcpPath);
			const studyPlaybookStep = results[3];

			// Derive expected bytes from the bundled template — NOT from an inline constant.
			const template = obsidianBrainAideTemplate(brainPath);
			const parsed = parseBrainAideFromString(template);
			expect(parsed.kind).toBe("ok");
			if (parsed.kind !== "ok") return;
			const expectedStudyPlaybook = parsed.studyPlaybook;

			expect(studyPlaybookStep.status).toBe("would-create");
			expect(studyPlaybookStep.content).toBe(expectedStudyPlaybook);

			// The bytes have a non-trivial source — proves they flowed through the parser.
			expect(studyPlaybookStep.content).toBeTruthy();
		});

		it("research content matches the research body section between `<!-- aide-research-start -->` and `<!-- aide-research-end -->` from the bundled template", async () => {
			const projectRoot = makeProjectRoot();
			const brainPath = makeBrainPath();
			const mcpPath = makeMcpPath();

			const results = await provisionBrain(projectRoot, brainPath, mcpPath);
			const researchStep = results[4];

			// Derive expected bytes from the bundled template — NOT from an inline constant.
			const template = obsidianBrainAideTemplate(brainPath);
			const parsed = parseBrainAideFromString(template);
			expect(parsed.kind).toBe("ok");
			if (parsed.kind !== "ok") return;
			const expectedResearch = parsed.research;

			expect(researchStep.status).toBe("would-create");
			expect(researchStep.content).toBe(expectedResearch);

			// The bytes have a non-trivial source — proves they flowed through the parser.
			expect(researchStep.content).toBeTruthy();
		});
	});

	// -----------------------------------------------------------------------
	// 4c. Existing brain.aide: entry-point artifacts source from on-disk file
	// -----------------------------------------------------------------------

	describe("Existing brain.aide: entry-point artifacts source from on-disk file", () => {
		it("playbook content reflects user's playbook section edits in brain.aide", async () => {
			const projectRoot = makeProjectRoot();
			const brainPath = makeBrainPath();
			const mcpPath = makeMcpPath();

			// Pre-write a brain.aide with custom sentinel strings in all three entry-point sections.
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
				"<!-- aide-prose-start -->",
				"",
				"Prose content here.",
				"",
				"<!-- aide-prose-end -->",
				"",
				"<!-- aide-playbook-start -->",
				"",
				"# USER-EDITED-PLAYBOOK",
				"",
				"User customized this section.",
				"",
				"<!-- aide-playbook-end -->",
				"",
				"<!-- aide-study-playbook-start -->",
				"",
				"# USER-EDITED-STUDY-PLAYBOOK",
				"",
				"User customized this section.",
				"",
				"<!-- aide-study-playbook-end -->",
				"",
				"<!-- aide-research-start -->",
				"",
				"# USER-EDITED-RESEARCH",
				"",
				"User customized this section.",
				"",
				"<!-- aide-research-end -->",
			].join("\n");
			await writeFile(join(aideConfigDir, "brain.aide"), customContent, "utf-8");

			const results = await provisionBrain(projectRoot, brainPath, mcpPath);
			const playbookStep = results[2];

			expect(playbookStep.status).toBe("would-create");
			expect(playbookStep.content).toContain("USER-EDITED-PLAYBOOK");
		});

		it("studyPlaybook content reflects user's studyPlaybook section edits in brain.aide", async () => {
			const projectRoot = makeProjectRoot();
			const brainPath = makeBrainPath();
			const mcpPath = makeMcpPath();

			// Pre-write a brain.aide with custom sentinel strings in all three entry-point sections.
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
				"<!-- aide-prose-start -->",
				"",
				"Prose content here.",
				"",
				"<!-- aide-prose-end -->",
				"",
				"<!-- aide-playbook-start -->",
				"",
				"# USER-EDITED-PLAYBOOK",
				"",
				"User customized this section.",
				"",
				"<!-- aide-playbook-end -->",
				"",
				"<!-- aide-study-playbook-start -->",
				"",
				"# USER-EDITED-STUDY-PLAYBOOK",
				"",
				"User customized this section.",
				"",
				"<!-- aide-study-playbook-end -->",
				"",
				"<!-- aide-research-start -->",
				"",
				"# USER-EDITED-RESEARCH",
				"",
				"User customized this section.",
				"",
				"<!-- aide-research-end -->",
			].join("\n");
			await writeFile(join(aideConfigDir, "brain.aide"), customContent, "utf-8");

			const results = await provisionBrain(projectRoot, brainPath, mcpPath);
			const studyPlaybookStep = results[3];

			expect(studyPlaybookStep.status).toBe("would-create");
			expect(studyPlaybookStep.content).toContain("USER-EDITED-STUDY-PLAYBOOK");
		});

		it("research content reflects user's research section edits in brain.aide", async () => {
			const projectRoot = makeProjectRoot();
			const brainPath = makeBrainPath();
			const mcpPath = makeMcpPath();

			// Pre-write a brain.aide with custom sentinel strings in all three entry-point sections.
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
				"<!-- aide-prose-start -->",
				"",
				"Prose content here.",
				"",
				"<!-- aide-prose-end -->",
				"",
				"<!-- aide-playbook-start -->",
				"",
				"# USER-EDITED-PLAYBOOK",
				"",
				"User customized this section.",
				"",
				"<!-- aide-playbook-end -->",
				"",
				"<!-- aide-study-playbook-start -->",
				"",
				"# USER-EDITED-STUDY-PLAYBOOK",
				"",
				"User customized this section.",
				"",
				"<!-- aide-study-playbook-end -->",
				"",
				"<!-- aide-research-start -->",
				"",
				"# USER-EDITED-RESEARCH",
				"",
				"User customized this section.",
				"",
				"<!-- aide-research-end -->",
			].join("\n");
			await writeFile(join(aideConfigDir, "brain.aide"), customContent, "utf-8");

			const results = await provisionBrain(projectRoot, brainPath, mcpPath);
			const researchStep = results[4];

			expect(researchStep.status).toBe("would-create");
			expect(researchStep.content).toContain("USER-EDITED-RESEARCH");
		});
	});

	// -----------------------------------------------------------------------
	// 4d. Malformed brain.aide: entry-point steps surface as would-skip
	// -----------------------------------------------------------------------

	describe("Malformed brain.aide: entry-point steps surface as would-skip", () => {
		it("playbook and research entry-point steps surface would-skip when brain.aide body fails to parse", async () => {
			const projectRoot = makeProjectRoot();
			const brainPath = makeBrainPath();
			const mcpPath = makeMcpPath();

			// Pre-write brain.aide with valid frontmatter but a heading-only body with no
			// marker pairs anywhere. This is the canonical strict-failure migration case:
			// the marker-pair parser rejects it with malformed-body (missing markers).
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
				"Only prose — no marker pairs anywhere, so the parser returns malformed-body.",
			].join("\n");
			await writeFile(join(aideConfigDir, "brain.aide"), malformedContent, "utf-8");

			const results = await provisionBrain(projectRoot, brainPath, mcpPath);

			const playbookStep = results[2];
			const studyPlaybookStep = results[3];
			const researchStep = results[4];

			// Entry-point steps must be would-skip when the body is malformed.
			expect(playbookStep.status).toBe("would-skip");
			expect(studyPlaybookStep.status).toBe("would-skip");
			expect(researchStep.status).toBe("would-skip");

			// All three must carry an actionable instructions field.
			expect(playbookStep.instructions).toBeTruthy();
			expect(studyPlaybookStep.instructions).toBeTruthy();
			expect(researchStep.instructions).toBeTruthy();

			// brain.aide step: file is on disk, so the presence check passes.
			// The brain config step does NOT validate body — only presence.
			const brainAideStep = results[0];
			expect(brainAideStep.status).toBe("exists");

			// MCP step: frontmatter is still valid, so the prescription is derivable.
			const mcpStep = results[5];
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

		const mcpStep = results[5];
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

		const mcpStep = results[5];
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
		// Fixture uses marker-pair grammar so the parser succeeds on the body.
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
			"<!-- aide-prose-start -->",
			"",
			"Custom user prose.",
			"",
			"<!-- aide-prose-end -->",
			"",
			"<!-- aide-playbook-start -->",
			"",
			"# Custom Playbook",
			"",
			"<!-- aide-playbook-end -->",
			"",
			"<!-- aide-study-playbook-start -->",
			"",
			"# Custom Study Playbook",
			"",
			"<!-- aide-study-playbook-end -->",
			"",
			"<!-- aide-research-start -->",
			"",
			"# Custom Research",
			"",
			"<!-- aide-research-end -->",
		].join("\n");

		const aideConfigDir = join(projectRoot, ".aide", "config");
		await mkdir(aideConfigDir, { recursive: true });
		await writeFile(join(aideConfigDir, "brain.aide"), customBrainAide, "utf-8");

		const results = await provisionBrain(projectRoot, brainPath, mcpPath);

		const mcpStep = results[5];
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

		const mcpStep = results[5];
		expect(mcpStep.name).toBe("MCP config (brain)");
		expect(mcpStep.status).toBe("would-overwrite");
		expect(mcpStep.prescription?.key).toBe("brain");
	});

	// -----------------------------------------------------------------------
	// 5f. Full idempotency — all five steps return exists
	// -----------------------------------------------------------------------

	it("5f: fully provisioned project — all six steps return exists", async () => {
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

		// Playbook entry-point.
		await mkdir(join(brainPath, "coding-playbook"), { recursive: true });
		await writeFile(
			join(brainPath, "coding-playbook", "coding-playbook.md"),
			"# Coding Playbook\n",
			"utf-8",
		);

		// Study-playbook entry-point (reuses existing coding-playbook directory).
		await writeFile(
			join(brainPath, "coding-playbook", "study-playbook.md"),
			"# Study Playbook\n",
			"utf-8",
		);

		// Research entry-point.
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

		expect(results).toHaveLength(6);
		expect(results[0].status).toBe("exists"); // Brain config
		expect(results[1].status).toBe("exists"); // Brain root directories
		expect(results[2].status).toBe("exists"); // Playbook entry-point
		expect(results[3].status).toBe("exists"); // Study-playbook entry-point
		expect(results[4].status).toBe("exists"); // Research entry-point
		expect(results[5].status).toBe("exists"); // MCP config
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

	it("playbook entry-point is would-create with content", async () => {
		const projectRoot = makeProjectRoot();
		const brainPath = makeBrainPath();
		const mcpPath = makeMcpPath();

		const results = await provisionBrain(projectRoot, brainPath, mcpPath);
		const step = results[2];

		expect(step.name).toBe("Playbook entry-point");
		expect(step.status).toBe("would-create");
		expect(step.content).toBeTruthy();
	});

	it("playbook entry-point returns exists when file is present (seed-semantic — no byte comparison)", async () => {
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

	it("study-playbook entry-point is would-create with content", async () => {
		const projectRoot = makeProjectRoot();
		const brainPath = makeBrainPath();
		const mcpPath = makeMcpPath();

		const results = await provisionBrain(projectRoot, brainPath, mcpPath);
		const step = results[3];

		expect(step.name).toBe("Study-playbook entry-point");
		expect(step.status).toBe("would-create");
		expect(step.content).toBeTruthy();
	});

	it("study-playbook entry-point returns exists when file is present (seed-semantic — no byte comparison)", async () => {
		const projectRoot = makeProjectRoot();
		const brainPath = makeBrainPath();
		const mcpPath = makeMcpPath();
		await mkdir(join(brainPath, "coding-playbook"), { recursive: true });
		await writeFile(
			join(brainPath, "coding-playbook", "study-playbook.md"),
			"# My curated study-playbook\n\nUser modified this.\n",
			"utf-8",
		);

		const results = await provisionBrain(projectRoot, brainPath, mcpPath);

		expect(results[3].status).toBe("exists");
		expect(results[3].content).toBeUndefined();
	});

	it("research entry-point is would-create with content", async () => {
		const projectRoot = makeProjectRoot();
		const brainPath = makeBrainPath();
		const mcpPath = makeMcpPath();

		const results = await provisionBrain(projectRoot, brainPath, mcpPath);
		const step = results[4];

		expect(step.name).toBe("Research entry-point");
		expect(step.status).toBe("would-create");
		expect(step.content).toBeTruthy();
	});

	it("research entry-point returns exists when file is present (seed-semantic — no byte comparison)", async () => {
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

		expect(results[4].status).toBe("exists");
		expect(results[4].content).toBeUndefined();
	});

	it("cold install (no brain, no obsidian key in existing .mcp.json) yields would-create with key brain", async () => {
		const projectRoot = makeProjectRoot();
		const brainPath = makeBrainPath();
		const mcpPath = makeMcpPath();
		await writeFile(mcpPath, JSON.stringify({ mcpServers: {} }), "utf-8");

		const results = await provisionBrain(projectRoot, brainPath, mcpPath);

		const mcpStep = results[5];
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

		const mcpStep = results[5];
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

		const mcpStep = results[5];
		expect(mcpStep.status).toBe("would-overwrite");
		expect(mcpStep.prescription?.key).toBe("brain");
	});

	it("malformed .mcp.json yields would-create with configMalformed: true", async () => {
		const projectRoot = makeProjectRoot();
		const brainPath = makeBrainPath();
		const mcpPath = makeMcpPath();
		await writeFile(mcpPath, "not valid json {{{", "utf-8");

		const results = await provisionBrain(projectRoot, brainPath, mcpPath);

		const mcpStep = results[5];
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
		await expect(access(join(brainPath, "coding-playbook", "study-playbook.md"))).rejects.toThrow();
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
				await writeFile(
					join(brainPath, "coding-playbook", "study-playbook.md"),
					"# My curated study-playbook\n",
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
			it("playbook entry-point status is never would-overwrite", async () => {
				const projectRoot = makeProjectRoot();
				const brainPath = makeBrainPath();
				const mcpPath = makeMcpPath();
				await setup(projectRoot, brainPath);

				const results = await provisionBrain(projectRoot, brainPath, mcpPath);

				expect(results[2].status).not.toBe("would-overwrite");
			});

			it("study-playbook entry-point status is never would-overwrite", async () => {
				const projectRoot = makeProjectRoot();
				const brainPath = makeBrainPath();
				const mcpPath = makeMcpPath();
				await setup(projectRoot, brainPath);

				const results = await provisionBrain(projectRoot, brainPath, mcpPath);

				expect(results[3].status).not.toBe("would-overwrite");
			});

			it("research entry-point status is never would-overwrite", async () => {
				const projectRoot = makeProjectRoot();
				const brainPath = makeBrainPath();
				const mcpPath = makeMcpPath();
				await setup(projectRoot, brainPath);

				const results = await provisionBrain(projectRoot, brainPath, mcpPath);

				expect(results[4].status).not.toBe("would-overwrite");
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
