/**
 * invariant: provisionBrain returns exactly TWO InitStep records — brain.aide scaffold first,
 * MCP entry plan second. No third step, no fifth, no seventh. The five retired step builders
 * (buildBrainRootStep, buildPlaybookStep, buildStudyPlaybookStep, buildUpdatePlaybookStep,
 * buildResearchStep) are gone; restoring any of them under any rename is the structural
 * regression the spec forbids.
 *
 * invariant: No brainPath parameter at any layer. provisionBrain(projectRoot, mcpPath) is
 * the two-argument signature; obsidianBrainAideTemplate() is called with no arguments.
 *
 * invariant: The unwired-slot signal is YAML null. brain.aide args may carry null at the
 * path slot; that null propagates verbatim through parseBrainAide + interpolateArgs into the
 * MCP step's prescription. provisionBrain never substitutes, drops, or coerces null at any
 * layer. Sync (downstream) refuses to write null-bearing args.
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

/** Returns a brain path string for use in fixture construction — NOT passed to provisionBrain. */
function makeBrainPath(): string {
	return join(tempDir, "brain");
}

/** Returns the .mcp.json path for the current test. */
function makeMcpPath(): string {
	return join(tempDir, ".mcp.json");
}

/**
 * Build a valid six-section brain.aide fixture string.
 *
 * The `orientation` and `config` sections carry trivial placeholder prose — they are
 * not read by this module, so their bytes are irrelevant to assertions; they only need
 * to be present so the parser succeeds.
 *
 * When `args` is omitted, the default carries a JS null at the path slot, mirroring the
 * bundled template's YAML null. Tests that need a wired brain.aide must pass explicit args
 * containing a real string at the path slot.
 *
 * Per-element YAML emission rule: a JS `null` at any index emits a bare-dash line (`    -`)
 * which the YAML parser reads back as JS `null`. A string emits `    - <string>`.
 */
function makeSixSectionBrainAide(
	_brainPath: string,
	opts: {
		playbookContent?: string;
		studyPlaybookContent?: string;
		updatePlaybookContent?: string;
		researchContent?: string;
		command?: string;
		args?: (string | null)[];
	} = {},
): string {
	const command = opts.command ?? "npx";
	const args: (string | null)[] = opts.args ?? [`'@bitbonsai/mcpvault'`, null];
	const playbookContent = opts.playbookContent ?? "# Playbook\n\nPlaybook content.";
	const studyPlaybookContent = opts.studyPlaybookContent ?? "# Study Playbook\n\nStudy content.";
	const updatePlaybookContent = opts.updatePlaybookContent ?? "# Update Playbook\n\nUpdate content.";
	const researchContent = opts.researchContent ?? "# Research\n\nResearch content.";

	return [
		"---",
		"name: obsidian",
		"mcpServerConfig:",
		`  command: ${command}`,
		"  args:",
		...args.map((a) => (a === null ? `    -` : `    - ${a}`)),
		"---",
		"",
		"<!-- aide-orientation-start -->",
		"",
		"Orientation content here.",
		"",
		"<!-- aide-orientation-end -->",
		"",
		"<!-- aide-config-start -->",
		"",
		"Config content here.",
		"",
		"<!-- aide-config-end -->",
		"",
		"<!-- aide-playbook-index-start -->",
		"",
		playbookContent,
		"",
		"<!-- aide-playbook-index-end -->",
		"",
		"<!-- aide-study-playbook-start -->",
		"",
		studyPlaybookContent,
		"",
		"<!-- aide-study-playbook-end -->",
		"",
		"<!-- aide-update-playbook-start -->",
		"",
		updatePlaybookContent,
		"",
		"<!-- aide-update-playbook-end -->",
		"",
		"<!-- aide-research-index-start -->",
		"",
		researchContent,
		"",
		"<!-- aide-research-index-end -->",
	].join("\n");
}

describe("provisionBrain", () => {
	// -----------------------------------------------------------------------
	// Two-step contract
	// -----------------------------------------------------------------------

	it("returns exactly two InitStep items in fixed order", async () => {
		const projectRoot = makeProjectRoot();
		const mcpPath = makeMcpPath();

		const results = await provisionBrain(projectRoot, mcpPath);

		expect(results).toHaveLength(2);
		expect(results[0].name).toBe("Brain config (brain.aide)");
		expect(results[0].category).toBe("brain");
		expect(results[0].filePath).toBe(join(projectRoot, ".aide", "config", "brain.aide"));
		expect(results[1].name).toBe("MCP config (brain)");
		expect(results[1].category).toBe("mcp");
	});

	// -----------------------------------------------------------------------
	// 5a. Cold install scaffolds brain.aide
	// -----------------------------------------------------------------------

	it("5a: cold install — Brain config step is would-create with parseable content", async () => {
		const projectRoot = makeProjectRoot();
		const mcpPath = makeMcpPath();

		const results = await provisionBrain(projectRoot, mcpPath);

		expect(results).toHaveLength(2);

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
	// YAML-null propagation
	// -----------------------------------------------------------------------

	describe("cold install — bundled template emits YAML null at path slot and MCP prescription carries null verbatim", () => {
		it("POSIX: args[1] is exactly null in both brain config content and MCP prescription", async () => {
			mockPlatform.mockReturnValue("linux");

			const projectRoot = makeProjectRoot();
			const mcpPath = makeMcpPath();

			const results = await provisionBrain(projectRoot, mcpPath);

			expect(results[0].status).toBe("would-create");
			expect(results[1].status).toBe("would-create");

			const parsedContent = parseBrainAideFromString(results[0].content!);
			expect(parsedContent.kind).toBe("ok");
			if (parsedContent.kind !== "ok") return;

			// POSIX shape: ["@bitbonsai/mcpvault", null] — null at index 1.
			expect(parsedContent.mcpServerConfig.args[1]).toBeNull();

			// MCP prescription must carry the same null verbatim.
			expect(results[1].prescription!.entry.args[1]).toBeNull();

			// The retired literal sentinel must not appear anywhere.
			expect(results[0].content!).not.toContain("<BRAIN_PATH>");
			expect(results[1].prescription!.entry.args).not.toContain("<BRAIN_PATH>");
		});

		it("win32: args[3] is exactly null in both brain config content and MCP prescription", async () => {
			mockPlatform.mockReturnValue("win32");

			const projectRoot = makeProjectRoot();
			const mcpPath = makeMcpPath();

			const results = await provisionBrain(projectRoot, mcpPath);

			expect(results[0].status).toBe("would-create");
			expect(results[1].status).toBe("would-create");

			const parsedContent = parseBrainAideFromString(results[0].content!);
			expect(parsedContent.kind).toBe("ok");
			if (parsedContent.kind !== "ok") return;

			// win32 shape: ["/c", "npx", "@bitbonsai/mcpvault", null] — null at index 3.
			expect(parsedContent.mcpServerConfig.args[3]).toBeNull();

			// MCP prescription must carry the same null verbatim.
			expect(results[1].prescription!.entry.args[3]).toBeNull();

			// The retired literal sentinel must not appear anywhere.
			expect(results[0].content!).not.toContain("<BRAIN_PATH>");
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
		const aideConfigDir = join(projectRoot, ".aide", "config");
		await mkdir(aideConfigDir, { recursive: true });
		await writeFile(
			join(aideConfigDir, "brain.aide"),
			makeSixSectionBrainAide(brainPath),
			"utf-8",
		);

		const results = await provisionBrain(projectRoot, mcpPath);

		const brainAideStep = results[0];
		expect(brainAideStep.name).toBe("Brain config (brain.aide)");
		expect(brainAideStep.status).toBe("exists");
		expect(brainAideStep.content).toBeUndefined();
	});

	// -----------------------------------------------------------------------
	// brain.aide step never returns would-overwrite under any condition
	// -----------------------------------------------------------------------

	it("brain.aide step is exists when the file has user-customized bytes (never would-overwrite)", async () => {
		const projectRoot = makeProjectRoot();
		const mcpPath = makeMcpPath();

		// Write a brain.aide whose bytes are nothing like the bundled template.
		const aideConfigDir = join(projectRoot, ".aide", "config");
		await mkdir(aideConfigDir, { recursive: true });
		await writeFile(
			join(aideConfigDir, "brain.aide"),
			"completely arbitrary content that does not match the template",
			"utf-8",
		);

		const results = await provisionBrain(projectRoot, mcpPath);

		expect(results[0].status).toBe("exists");
		expect(results[0].status).not.toBe("would-overwrite");
	});

	it("brain.aide step is exists and MCP step uses empty-fallback prescription when brain.aide body is malformed", async () => {
		const projectRoot = makeProjectRoot();
		const mcpPath = makeMcpPath();

		// Valid frontmatter but no marker pairs — parser returns malformed-body.
		const malformedContent = [
			"---",
			"name: obsidian",
			"mcpServerConfig:",
			"  command: npx",
			"  args:",
			`    - '@bitbonsai/mcpvault'`,
			`    -`,
			"---",
			"",
			"## Only headings — no marker pairs anywhere.",
		].join("\n");

		const aideConfigDir = join(projectRoot, ".aide", "config");
		await mkdir(aideConfigDir, { recursive: true });
		await writeFile(join(aideConfigDir, "brain.aide"), malformedContent, "utf-8");

		const results = await provisionBrain(projectRoot, mcpPath);

		// brain.aide step: file is present, presence check passes.
		expect(results[0].status).toBe("exists");
		expect(results[0].status).not.toBe("would-overwrite");

		// MCP step: parser failed (malformed-body), so resolveBrainAideConfig returns null.
		// Prescription uses the empty fallback; step is would-create (no brain key on disk).
		expect(results[1].name).toBe("MCP config (brain)");
		expect(results[1].prescription!.entry.command).toBe("");
		expect(results[1].prescription!.entry.args).toEqual([]);
	});

	// -----------------------------------------------------------------------
	// 5c. MCP step derives from scaffolded brain.aide on cold install
	// -----------------------------------------------------------------------

	it("5c (win32): cold install — MCP entry derived from template args on Windows", async () => {
		mockPlatform.mockReturnValue("win32");

		const projectRoot = makeProjectRoot();
		const mcpPath = makeMcpPath();

		const results = await provisionBrain(projectRoot, mcpPath);

		// On cold install, the template bytes drive the derivation.
		const templateContent = obsidianBrainAideTemplate();
		const parsed = parseBrainAideFromString(templateContent);
		expect(parsed.kind).toBe("ok");
		if (parsed.kind !== "ok") return;

		const expectedArgs = interpolateArgs(parsed);
		const expectedEntry = {
			command: parsed.mcpServerConfig.command,
			args: expectedArgs,
		};

		const mcpStep = results[1];
		expect(mcpStep.name).toBe("MCP config (brain)");
		expect(mcpStep.prescription?.entry).toEqual(expectedEntry);

		// Windows-specific shape: cmd /c npx @bitbonsai/mcpvault <null at index 3>
		expect(mcpStep.prescription?.entry.command).toBe("cmd");
		expect(mcpStep.prescription?.entry.args[0]).toBe("/c");
		expect(mcpStep.prescription?.entry.args[1]).toBe("npx");
		expect(mcpStep.prescription?.entry.args[2]).toBe("@bitbonsai/mcpvault");
		expect(mcpStep.prescription?.entry.args[3]).toBeNull();
	});

	it("5c (posix): cold install — MCP entry derived from template args on POSIX", async () => {
		mockPlatform.mockReturnValue("linux");

		const projectRoot = makeProjectRoot();
		const mcpPath = makeMcpPath();

		const results = await provisionBrain(projectRoot, mcpPath);

		const templateContent = obsidianBrainAideTemplate();
		const parsed = parseBrainAideFromString(templateContent);
		expect(parsed.kind).toBe("ok");
		if (parsed.kind !== "ok") return;

		const expectedArgs = interpolateArgs(parsed);
		const expectedEntry = {
			command: parsed.mcpServerConfig.command,
			args: expectedArgs,
		};

		const mcpStep = results[1];
		expect(mcpStep.prescription?.entry).toEqual(expectedEntry);

		// POSIX shape: npx @bitbonsai/mcpvault <null at index 1>
		expect(mcpStep.prescription?.entry.command).toBe("npx");
		expect(mcpStep.prescription?.entry.args[0]).toBe("@bitbonsai/mcpvault");
		expect(mcpStep.prescription?.entry.args[1]).toBeNull();
	});

	// -----------------------------------------------------------------------
	// 5d. MCP step derives from existing brain.aide (source-of-truth test)
	// -----------------------------------------------------------------------

	it("5d: existing brain.aide with custom args — MCP entry reflects user's config, not canonical template", async () => {
		const projectRoot = makeProjectRoot();
		const brainPath = makeBrainPath();
		const mcpPath = makeMcpPath();

		// User has customized their brain.aide with a real path at the path slot.
		const customBrainAide = makeSixSectionBrainAide(brainPath, {
			command: "node",
			args: [`"/custom/path/to/launcher.js"`, `${brainPath}`],
			playbookContent: "# Custom Playbook",
			studyPlaybookContent: "# Custom Study Playbook",
			updatePlaybookContent: "# Custom Update Playbook",
			researchContent: "# Custom Research",
		});

		const aideConfigDir = join(projectRoot, ".aide", "config");
		await mkdir(aideConfigDir, { recursive: true });
		await writeFile(join(aideConfigDir, "brain.aide"), customBrainAide, "utf-8");

		const results = await provisionBrain(projectRoot, mcpPath);

		const mcpStep = results[1];
		// Must use user's custom command and args, NOT the canonical Obsidian template.
		expect(mcpStep.prescription?.entry.command).toBe("node");
		expect(mcpStep.prescription?.entry.args).toEqual(["/custom/path/to/launcher.js", brainPath]);

		// Confirm it does NOT match the canonical template.
		const templateParsed = parseBrainAideFromString(obsidianBrainAideTemplate());
		if (templateParsed.kind !== "ok") return;
		expect(mcpStep.prescription?.entry.command).not.toBe(templateParsed.mcpServerConfig.command);
	});

	// -----------------------------------------------------------------------
	// MCP step — four branches
	// -----------------------------------------------------------------------

	it("cold install (no brain key in existing .mcp.json) yields would-create with key brain", async () => {
		const projectRoot = makeProjectRoot();
		const mcpPath = makeMcpPath();
		await writeFile(mcpPath, JSON.stringify({ mcpServers: {} }), "utf-8");

		const results = await provisionBrain(projectRoot, mcpPath);

		const mcpStep = results[1];
		expect(mcpStep.status).toBe("would-create");
		expect(mcpStep.prescription?.key).toBe("brain");
	});

	it("malformed .mcp.json yields would-create with configMalformed: true", async () => {
		const projectRoot = makeProjectRoot();
		const mcpPath = makeMcpPath();
		await writeFile(mcpPath, "not valid json {{{", "utf-8");

		const results = await provisionBrain(projectRoot, mcpPath);

		const mcpStep = results[1];
		expect(mcpStep.status).toBe("would-create");
		expect(mcpStep.configMalformed).toBe(true);
		expect(mcpStep.prescription).toBeDefined();
	});

	// -----------------------------------------------------------------------
	// 5g. Brain key present but entry differs (drift) — would-overwrite
	// -----------------------------------------------------------------------

	it("5g: brain key present with drifted entry — MCP step is would-overwrite with prescription matching brain.aide", async () => {
		mockPlatform.mockReturnValue("linux");

		const projectRoot = makeProjectRoot();
		const brainPath = makeBrainPath();
		const mcpPath = makeMcpPath();

		// Pre-write a valid brain.aide with a wired path at the path slot.
		const brainAideContent = makeSixSectionBrainAide(brainPath, {
			args: [`'@bitbonsai/mcpvault'`, `'${brainPath}'`],
		});
		const aideConfigDir = join(projectRoot, ".aide", "config");
		await mkdir(aideConfigDir, { recursive: true });
		await writeFile(join(aideConfigDir, "brain.aide"), brainAideContent, "utf-8");

		// Pre-write a .mcp.json whose brain entry deliberately differs.
		const driftedEntry = { command: "node", args: ["/old/launcher.js", "/old/brain-path"] };
		await writeFile(
			mcpPath,
			JSON.stringify({ mcpServers: { brain: driftedEntry } }),
			"utf-8",
		);

		const results = await provisionBrain(projectRoot, mcpPath);

		const mcpStep = results[1];
		expect(mcpStep.name).toBe("MCP config (brain)");
		expect(mcpStep.status).toBe("would-overwrite");
		expect(mcpStep.prescription?.key).toBe("brain");

		// The prescription must match brain.aide's derived entry, NOT the on-disk drifted one.
		const parsed = parseBrainAideFromString(brainAideContent);
		expect(parsed.kind).toBe("ok");
		if (parsed.kind !== "ok") return;
		const expectedEntry = {
			command: parsed.mcpServerConfig.command,
			args: interpolateArgs(parsed),
		};
		expect(mcpStep.prescription?.entry).toEqual(expectedEntry);

		// Sanity: the prescription must NOT equal the drifted on-disk entry.
		expect(mcpStep.prescription?.entry.command).not.toBe(driftedEntry.command);
		expect(mcpStep.prescription?.entry.args).not.toEqual(driftedEntry.args);
	});

	// -----------------------------------------------------------------------
	// 5f. Fully provisioned project — both steps return exists
	// -----------------------------------------------------------------------

	it("5f: fully provisioned project — both steps return exists", async () => {
		// Must mock a deterministic platform so template bytes are stable.
		mockPlatform.mockReturnValue("linux");

		const projectRoot = makeProjectRoot();
		const brainPath = makeBrainPath();
		const mcpPath = makeMcpPath();

		// Brain config file — write with a wired path so the derived MCP entry has real args.
		const brainAideContent = makeSixSectionBrainAide(brainPath, {
			args: [`'@bitbonsai/mcpvault'`, `'${brainPath}'`],
		});
		const aideConfigDir = join(projectRoot, ".aide", "config");
		await mkdir(aideConfigDir, { recursive: true });
		await writeFile(join(aideConfigDir, "brain.aide"), brainAideContent, "utf-8");

		// .mcp.json with the derived brain entry.
		const parsed = parseBrainAideFromString(brainAideContent);
		expect(parsed.kind).toBe("ok");
		if (parsed.kind !== "ok") return;
		const derivedEntry = {
			command: parsed.mcpServerConfig.command,
			args: interpolateArgs(parsed),
		};
		await writeFile(
			mcpPath,
			JSON.stringify({ mcpServers: { brain: derivedEntry } }),
			"utf-8",
		);

		const results = await provisionBrain(projectRoot, mcpPath);

		expect(results).toHaveLength(2);
		expect(results[0].status).toBe("exists"); // Brain config
		expect(results[1].status).toBe("exists"); // MCP config
	});

	// -----------------------------------------------------------------------
	// YAML-null-specific MCP step branches
	// -----------------------------------------------------------------------

	it("MCP step is exists when .mcp.json brain entry matches the derived null-bearing prescription", async () => {
		mockPlatform.mockReturnValue("linux");

		const projectRoot = makeProjectRoot();
		const mcpPath = makeMcpPath();

		// Pre-write a brain.aide via default makeSixSectionBrainAide (null at args[1]).
		const brainAideContent = makeSixSectionBrainAide(makeBrainPath());
		const aideConfigDir = join(projectRoot, ".aide", "config");
		await mkdir(aideConfigDir, { recursive: true });
		await writeFile(join(aideConfigDir, "brain.aide"), brainAideContent, "utf-8");

		// Pre-write .mcp.json with a brain entry whose args also carry null at index 1.
		// JSON serializes JS null as the token `null`, so JSON.parse will yield JS null.
		await writeFile(
			mcpPath,
			JSON.stringify({ mcpServers: { brain: { command: "npx", args: ["@bitbonsai/mcpvault", null] } } }),
			"utf-8",
		);

		const results = await provisionBrain(projectRoot, mcpPath);

		// Both sides carry null — null === null is true, so MCP step is exists.
		expect(results[1].status).toBe("exists");
	});

	it("MCP step is would-overwrite when on-disk brain entry has null but derived prescription has a real string", async () => {
		mockPlatform.mockReturnValue("linux");

		const projectRoot = makeProjectRoot();
		const brainPath = makeBrainPath();
		const mcpPath = makeMcpPath();

		// Pre-write a brain.aide with a real path at the path slot (wired state).
		const brainAideContent = makeSixSectionBrainAide(brainPath, {
			args: [`'@bitbonsai/mcpvault'`, `'${brainPath}'`],
		});
		const aideConfigDir = join(projectRoot, ".aide", "config");
		await mkdir(aideConfigDir, { recursive: true });
		await writeFile(join(aideConfigDir, "brain.aide"), brainAideContent, "utf-8");

		// .mcp.json still has null at index 1 (stale — user filled brain.aide but never re-ran sync).
		await writeFile(
			mcpPath,
			JSON.stringify({ mcpServers: { brain: { command: "npx", args: ["@bitbonsai/mcpvault", null] } } }),
			"utf-8",
		);

		const results = await provisionBrain(projectRoot, mcpPath);

		// Real string vs null → drift → would-overwrite.
		expect(results[1].status).toBe("would-overwrite");

		// Prescription carries the wired path — derived from brain.aide.
		const parsed = parseBrainAideFromString(brainAideContent);
		expect(parsed.kind).toBe("ok");
		if (parsed.kind !== "ok") return;
		const expectedArgs = interpolateArgs(parsed);
		expect(results[1].prescription!.entry.args).toEqual(expectedArgs);
	});

	// -----------------------------------------------------------------------
	// Regression guard: provisionBrain forwards null entries verbatim
	// -----------------------------------------------------------------------

	it("provisionBrain forwards null entries verbatim — no defensive substitution at any index", async () => {
		mockPlatform.mockReturnValue("linux");

		const projectRoot = makeProjectRoot();
		const mcpPath = makeMcpPath();

		// Pre-write a brain.aide with null at the path slot (default fixture).
		const brainAideContent = makeSixSectionBrainAide(makeBrainPath());
		const aideConfigDir = join(projectRoot, ".aide", "config");
		await mkdir(aideConfigDir, { recursive: true });
		await writeFile(join(aideConfigDir, "brain.aide"), brainAideContent, "utf-8");

		const results = await provisionBrain(projectRoot, mcpPath);

		// The prescription's args must carry a literal JS null at the path-slot index.
		// This is the regression guard against defensive null-replacement at plan time.
		const prescriptionArgs = results[1].prescription!.entry.args;
		expect(prescriptionArgs).toContain(null);
		// POSIX: null is at index 1.
		expect(prescriptionArgs[1]).toBeNull();
	});

	// -----------------------------------------------------------------------
	// 5h. brain.aide schema does NOT include intent-spec or deprecated fields
	// -----------------------------------------------------------------------

	it("5h: scaffolded brain.aide has no scope, outcomes, status, deprecated fields; only name and mcpServerConfig", async () => {
		mockPlatform.mockReturnValue("linux");

		const projectRoot = makeProjectRoot();

		// Get the template content as it would be written on a cold install.
		const templateContent = obsidianBrainAideTemplate();
		const parsed = parseBrainAideFromString(templateContent);

		expect(parsed.kind).toBe("ok");
		if (parsed.kind !== "ok") return;

		// The config object must NOT contain intent-spec frontmatter fields.
		const config = parsed as Record<string, unknown>;
		expect(config).not.toHaveProperty("scope");
		expect(config).not.toHaveProperty("outcomes");
		expect(config).not.toHaveProperty("status");
		expect(config).not.toHaveProperty("intent");

		// Must not contain deprecated fields.
		expect(config).not.toHaveProperty("connector");
		expect(config).not.toHaveProperty("rootPath");
		expect(config).not.toHaveProperty("entryFile");
		expect(config).not.toHaveProperty("tools");

		// Extract frontmatter block for a targeted check.
		const fenceStart = templateContent.indexOf("---\n");
		const fenceEnd = templateContent.indexOf("\n---\n", fenceStart + 3);
		const frontmatterBlock = templateContent.slice(fenceStart, fenceEnd);

		expect(frontmatterBlock).not.toContain("scope:");
		expect(frontmatterBlock).not.toContain("outcomes:");
		expect(frontmatterBlock).not.toContain("status:");
		expect(frontmatterBlock).not.toContain("intent:");
		expect(frontmatterBlock).not.toContain("connector:");
		expect(frontmatterBlock).not.toContain("rootPath:");
		expect(frontmatterBlock).not.toContain("entryFile:");
		expect(frontmatterBlock).not.toContain("tools:");

		// Required minimal-schema fields must be present.
		expect(frontmatterBlock).toContain("name:");
		expect(frontmatterBlock).toContain("mcpServerConfig:");
	});

	// -----------------------------------------------------------------------
	// never writes to disk
	// -----------------------------------------------------------------------

	it("never writes to disk", async () => {
		const projectRoot = makeProjectRoot();
		const mcpPath = makeMcpPath();

		await provisionBrain(projectRoot, mcpPath);

		const { access } = await import("node:fs/promises");
		await expect(access(mcpPath)).rejects.toThrow();
		// brain.aide must NOT be written either.
		await expect(access(join(projectRoot, ".aide", "config", "brain.aide"))).rejects.toThrow();
	});
});
