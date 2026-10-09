import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import brainContract from "@/service/brainContract/index.js";
import parseBrainAide, { parseBrainAideFromString, interpolateArgs } from "@/service/parseBrainAide/index.js";
import type { BrainAideConfig, LaunchMode } from "@/types/index.js";

// ---------------------------------------------------------------------------
// Module-scope mock for node:os — each test that needs platform branching
// sets the return value before importing the template.
// ---------------------------------------------------------------------------

vi.mock("node:os", async (importOriginal) => {
	const original = await importOriginal<typeof import("node:os")>();
	return {
		...original,
		platform: vi.fn(() => original.platform()),
	};
});

// ---------------------------------------------------------------------------
// Lifecycle: temp directory for round-trip tests
// ---------------------------------------------------------------------------

let tempDir: string;

beforeEach(async () => {
	tempDir = await mkdtemp(join(tmpdir(), "aide-obsidian-template-"));
});

afterEach(async () => {
	await rm(tempDir, { recursive: true, force: true });
	vi.resetModules();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function getTemplate(mockedPlatform?: "win32" | "posix", mode?: LaunchMode): Promise<string> {
	const { platform } = await import("node:os");
	if (mockedPlatform !== undefined) {
		vi.mocked(platform).mockReturnValue(mockedPlatform === "win32" ? "win32" : "linux");
	}
	const { default: obsidianBrainAideTemplate } = await import("./index.js");
	return obsidianBrainAideTemplate(mode);
}

async function writeBrainAide(root: string, content: string): Promise<void> {
	await mkdir(join(root, ".aide", "config"), { recursive: true });
	await writeFile(join(root, ".aide", "config", "brain.aide"), content, "utf-8");
}

// ---------------------------------------------------------------------------
// path slot is YAML null in every emission
// ---------------------------------------------------------------------------

describe("path slot is YAML null in every emission", () => {
	it("on POSIX: parsed args at index 2 is exactly null", async () => {
		const content = await getTemplate("posix");
		const result = parseBrainAideFromString(content);

		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return;

		expect(result.mcpServerConfig.args[2]).toBeNull();
	});

	it("on win32: parsed args at index 4 is exactly null", async () => {
		const content = await getTemplate("win32");
		const result = parseBrainAideFromString(content);

		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return;

		expect(result.mcpServerConfig.args[4]).toBeNull();
	});

	it("the literal token '<BRAIN_PATH>' does not appear anywhere in the template output", async () => {
		const posixContent = await getTemplate("posix");
		expect(posixContent).not.toContain("<BRAIN_PATH>");

		const win32Content = await getTemplate("win32");
		expect(win32Content).not.toContain("<BRAIN_PATH>");
	});

	it("interpolateArgs preserves null at the path slot — not coerced to empty string, not skipped", async () => {
		const content = await getTemplate("posix");
		const result = parseBrainAideFromString(content);

		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return;

		const brainAideConfig: BrainAideConfig = { name: result.name, mcpServerConfig: result.mcpServerConfig };
		const interpolated = interpolateArgs(brainAideConfig);

		// null at args[2] for POSIX — must be null, not "" and not absent
		expect(interpolated[2]).toBeNull();
		expect(interpolated).toHaveLength(result.mcpServerConfig.args.length);
	});
});

// ---------------------------------------------------------------------------
// Round-trip parses cleanly under the new schema
// ---------------------------------------------------------------------------

describe("round-trip parses cleanly under the new schema", () => {
	it("template output round-trips through parseBrainAide with kind ok", async () => {
		const content = await getTemplate();

		await writeBrainAide(tempDir, content);
		const result = await parseBrainAide(tempDir);

		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return;

		expect(result.name).toBe("obsidian");
		expect(result.playbookIndex.length).toBeGreaterThan(0);
		expect(result.researchIndex.length).toBeGreaterThan(0);
	});

	it("parseBrainAideFromString produces the same ok result as writing to disk", async () => {
		const content = await getTemplate();

		await writeBrainAide(tempDir, content);
		const fromDisk = await parseBrainAide(tempDir);
		const fromString = parseBrainAideFromString(content);

		expect(fromDisk.kind).toBe("ok");
		expect(fromString.kind).toBe("ok");
		expect(fromDisk).toEqual(fromString);
	});
});

// ---------------------------------------------------------------------------
// Contract body shape
// ---------------------------------------------------------------------------

describe("contract body shape", () => {
	it("result.kind is ok — parser accepts the full contract, so a fresh scaffold boots clean", async () => {
		const content = await getTemplate();
		const result = parseBrainAideFromString(content);

		expect(result.kind).toBe("ok");
	});

	it("orientation is a non-empty string", async () => {
		const content = await getTemplate();
		const result = parseBrainAideFromString(content);

		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return;

		expect(typeof result.orientation).toBe("string");
		expect(result.orientation.length).toBeGreaterThan(0);
	});

	it("config is a non-empty string", async () => {
		const content = await getTemplate();
		const result = parseBrainAideFromString(content);

		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return;

		expect(typeof result.config).toBe("string");
		expect(result.config.length).toBeGreaterThan(0);
	});

	it("playbookIndex is a non-empty string", async () => {
		const content = await getTemplate();
		const result = parseBrainAideFromString(content);

		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return;

		expect(typeof result.playbookIndex).toBe("string");
		expect(result.playbookIndex.length).toBeGreaterThan(0);
	});

	it("studyPlaybook is a non-empty string", async () => {
		const content = await getTemplate();
		const result = parseBrainAideFromString(content);

		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return;

		expect(typeof result.studyPlaybook).toBe("string");
		expect(result.studyPlaybook.length).toBeGreaterThan(0);
	});

	it("updatePlaybook is a non-empty string", async () => {
		const content = await getTemplate();
		const result = parseBrainAideFromString(content);

		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return;

		expect(typeof result.updatePlaybook).toBe("string");
		expect(result.updatePlaybook.length).toBeGreaterThan(0);
	});

	it("researchIndex is a non-empty string", async () => {
		const content = await getTemplate();
		const result = parseBrainAideFromString(content);

		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return;

		expect(typeof result.researchIndex).toBe("string");
		expect(result.researchIndex.length).toBeGreaterThan(0);
	});

	it.each(brainContract.map(({ field }) => field))("contract field %s is non-empty", async (field) => {
		const content = await getTemplate();
		const result = parseBrainAideFromString(content);

		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return;

		expect(result[field].trim().length).toBeGreaterThan(0);
	});

	it("every body section is pairwise byte-distinct", async () => {
		const content = await getTemplate();
		const result = parseBrainAideFromString(content);

		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return;

		const sections = brainContract.map(({ field }) => result[field]);
		expect(sections).toHaveLength(brainContract.length);

		for (let i = 0; i < sections.length; i++) {
			for (let j = i + 1; j < sections.length; j++) {
				expect(sections[i]).not.toBe(sections[j]);
			}
		}
	});
});

// ---------------------------------------------------------------------------
// Playbook-index section preserves sentinel structure
// ---------------------------------------------------------------------------

describe("Playbook-index section preserves sentinel structure", () => {
	it("playbookIndex contains the H1 title '# Coding Playbook'", async () => {
		const content = await getTemplate();
		const result = parseBrainAideFromString(content);

		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return;

		expect(result.playbookIndex).toContain("# Coding Playbook");
	});

	it("playbookIndex contains '## Task Routing' (top-level sub-section under # Coding Playbook)", async () => {
		const content = await getTemplate();
		const result = parseBrainAideFromString(content);

		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return;

		expect(result.playbookIndex).toMatch(/^## Task Routing$/m);
	});

	it("playbookIndex contains '[[your-conventions-note]]'", async () => {
		const content = await getTemplate();
		const result = parseBrainAideFromString(content);

		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return;

		expect(result.playbookIndex).toContain("[[your-conventions-note]]");
	});

	it("playbookIndex contains '[[your-folder-structure-note]]'", async () => {
		const content = await getTemplate();
		const result = parseBrainAideFromString(content);

		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return;

		expect(result.playbookIndex).toContain("[[your-folder-structure-note]]");
	});

	it("playbookIndex contains '## How to Use This Index' (parent for Always Read First)", async () => {
		const content = await getTemplate();
		const result = parseBrainAideFromString(content);

		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return;

		expect(result.playbookIndex).toMatch(/^## How to Use This Index$/m);
	});

	it("playbookIndex does NOT contain procedural Step-1/Step-2/Step-3 narration", async () => {
		const content = await getTemplate();
		const result = parseBrainAideFromString(content);

		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return;

		expect(result.playbookIndex).not.toContain("Step 1:");
		expect(result.playbookIndex).not.toContain("Step 2:");
		expect(result.playbookIndex).not.toContain("Step 3:");
	});
});

// ---------------------------------------------------------------------------
// studyPlaybook section ships the navigation methodology
// ---------------------------------------------------------------------------

describe("studyPlaybook section ships the navigation methodology", () => {
	it("studyPlaybook starts with an H1 heading", async () => {
		const content = await getTemplate();
		const result = parseBrainAideFromString(content);

		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return;

		expect(result.studyPlaybook.trimStart().startsWith("# ")).toBe(true);
	});

	it("studyPlaybook contains 'Step 1' procedural marker", async () => {
		const content = await getTemplate();
		const result = parseBrainAideFromString(content);

		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return;

		expect(result.studyPlaybook.includes("Step 1")).toBe(true);
	});

	it("studyPlaybook contains 'Step 2' procedural marker", async () => {
		const content = await getTemplate();
		const result = parseBrainAideFromString(content);

		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return;

		expect(result.studyPlaybook.includes("Step 2")).toBe(true);
	});

	it("studyPlaybook contains 'Step 3' procedural marker", async () => {
		const content = await getTemplate();
		const result = parseBrainAideFromString(content);

		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return;

		expect(result.studyPlaybook.includes("Step 3")).toBe(true);
	});

	it("studyPlaybook contains 'Navigation Rules' heading", async () => {
		const content = await getTemplate();
		const result = parseBrainAideFromString(content);

		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return;

		expect(result.studyPlaybook.includes("Navigation Rules")).toBe(true);
	});

	it("studyPlaybook contains the depth-counting example anchor", async () => {
		const content = await getTemplate();
		const result = parseBrainAideFromString(content);

		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return;

		expect(result.studyPlaybook).toMatch(/depth 0/i);
		expect(result.studyPlaybook).toMatch(/depth 1/i);
	});

	it("studyPlaybook contains the [[wikilink]] literal substring (user-owned-section carve-out)", async () => {
		const content = await getTemplate();
		const result = parseBrainAideFromString(content);

		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return;

		expect(result.studyPlaybook.includes("[[")).toBe(true);
		expect(result.studyPlaybook.includes("]]")).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// updatePlaybook section ships the playbook-maintenance methodology
// ---------------------------------------------------------------------------

describe("updatePlaybook section ships the playbook-maintenance methodology", () => {
	it("updatePlaybook is non-empty and contains '# Update Playbook'", async () => {
		const content = await getTemplate();
		const result = parseBrainAideFromString(content);

		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return;

		expect(result.updatePlaybook.trim().length).toBeGreaterThan(0);
		expect(result.updatePlaybook).toContain("# Update Playbook");
	});

	it("updatePlaybook describes the three-layer playbook structure (root hub, section hubs, child notes)", async () => {
		const content = await getTemplate();
		const result = parseBrainAideFromString(content);

		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return;

		expect(result.updatePlaybook).toContain("Root hub");
		expect(result.updatePlaybook).toContain("Section hubs");
		expect(result.updatePlaybook).toContain("Child notes");
	});

	it("updatePlaybook references the section-hub Subnotes table as the per-section index", async () => {
		const content = await getTemplate();
		const result = parseBrainAideFromString(content);

		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return;

		expect(result.updatePlaybook).toContain("## Subnotes");
	});

	it("updatePlaybook references the root-hub Task Routing table as the task-domain index", async () => {
		const content = await getTemplate();
		const result = parseBrainAideFromString(content);

		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return;

		expect(result.updatePlaybook).toContain("## Task Routing");
	});

	it("updatePlaybook is backend-agnostic — names no mcp__brain__* tools (those belong in orientation)", async () => {
		const content = await getTemplate();
		const result = parseBrainAideFromString(content);

		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return;

		expect(result.updatePlaybook).not.toContain("mcp__brain__patch_note");
		expect(result.updatePlaybook).not.toContain("mcp__brain__write_note");
		expect(result.updatePlaybook).not.toContain("mcp__brain__read_note");
	});

	it("updatePlaybook contains the routing-table drift-check anchor string", async () => {
		const content = await getTemplate();
		const result = parseBrainAideFromString(content);

		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return;

		expect(result.updatePlaybook).toContain("Routing-table drift check");
	});

	it("updatePlaybook is byte-distinct from studyPlaybook", async () => {
		const content = await getTemplate();
		const result = parseBrainAideFromString(content);

		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return;

		expect(result.updatePlaybook).not.toBe(result.studyPlaybook);
	});

	it("updatePlaybook anchors the scope-guard ('## What Belongs Here'), the folder-tree layout ('## Layout'), the progressive-disclosure rule ('## Note Scope'), the per-entry shape ('## Entry Format'), and the wikilink rule ('## Wikilink Format')", async () => {
		const content = await getTemplate();
		const result = parseBrainAideFromString(content);

		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return;

		expect(result.updatePlaybook).toMatch(/^## What Belongs Here$/m);
		expect(result.updatePlaybook).toMatch(/^## Layout$/m);
		expect(result.updatePlaybook).toMatch(/^## Note Scope/m);
		expect(result.updatePlaybook).toMatch(/^## Entry Format$/m);
		expect(result.updatePlaybook).toMatch(/^## Wikilink Format$/m);
	});

	it("updatePlaybook embeds the layout tree (illustrative section folders)", async () => {
		const content = await getTemplate();
		const result = parseBrainAideFromString(content);

		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return;

		// Tree shape — contains the root header and at least one labelled section folder.
		expect(result.updatePlaybook).toContain("coding-playbook/");
		expect(result.updatePlaybook).toContain("foundations.md");
	});

	it("updatePlaybook delegates structural orientation to study-playbook (pointer present)", async () => {
		const content = await getTemplate();
		const result = parseBrainAideFromString(content);

		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return;

		expect(result.updatePlaybook).toContain("coding-playbook/study-playbook.md");
	});

	it("updatePlaybook uses the generic provenance placeholder '<project-name>' and does not leak any private project name", async () => {
		const content = await getTemplate();
		const result = parseBrainAideFromString(content);

		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return;

		expect(result.updatePlaybook).toContain("<project-name>");
		// Guard against private-project name leakage in the seed bytes shipped to all users.
		expect(result.updatePlaybook).not.toMatch(/tetsukod/i);
	});
});

// ---------------------------------------------------------------------------
// config section ships the Obsidian wiring flow
// ---------------------------------------------------------------------------

describe("config section ships the Obsidian wiring flow", () => {
	it("config is non-empty", async () => {
		const content = await getTemplate();
		const result = parseBrainAideFromString(content);

		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return;

		expect(result.config.trim().length).toBeGreaterThan(0);
	});

	it("config mentions mcpServerConfig.args (the field that carries the brain path)", async () => {
		const content = await getTemplate();
		const result = parseBrainAideFromString(content);

		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return;

		expect(result.config).toContain("mcpServerConfig.args");
	});

	it("config describes YAML null as the unwired-state signal", async () => {
		const content = await getTemplate();
		const result = parseBrainAideFromString(content);

		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return;

		expect(result.config).toContain("YAML null");
	});

	it("config describes the last entry of mcpServerConfig.args as the unwired-state signal", async () => {
		const content = await getTemplate();
		const result = parseBrainAideFromString(content);

		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return;

		expect(result.config).toContain("last entry of `mcpServerConfig.args`");
	});

	it("config mentions /aide:brain config (the argument shape for Obsidian wiring)", async () => {
		const content = await getTemplate();
		const result = parseBrainAideFromString(content);

		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return;

		expect(result.config).toContain("/aide:brain config");
	});

	it("config contains a restart-style instruction", async () => {
		const content = await getTemplate();
		const result = parseBrainAideFromString(content);

		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return;

		expect(result.config).toContain("Restart");
	});

	it("config mentions mcp__brain__write_note (the entry-point seeding tool)", async () => {
		const content = await getTemplate();
		const result = parseBrainAideFromString(content);

		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return;

		expect(result.config).toContain("mcp__brain__write_note");
	});

	it("config seeds from the published contract: names brainContract, role seed and seedPath", async () => {
		const content = await getTemplate();
		const result = parseBrainAideFromString(content);

		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return;

		expect(result.config).toContain("brainContract");
		expect(result.config).toContain("`seed`");
		expect(result.config).toContain("seedPath");
		expect(result.config).toContain("Brain config (brain.aide)");
	});

	it("config no longer restates the seed-path list (the contract owns it)", async () => {
		const content = await getTemplate();
		const result = parseBrainAideFromString(content);

		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return;

		const seedPaths = brainContract.flatMap((entry) => (entry.role === "seed" ? [entry.seedPath] : []));
		expect(seedPaths.length).toBeGreaterThan(0);
		for (const seedPath of seedPaths) expect(result.config).not.toContain(seedPath);
	});

	it("config does not contain the retired <BRAIN_PATH> sentinel", async () => {
		const content = await getTemplate();
		const result = parseBrainAideFromString(content);

		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return;

		expect(result.config).not.toContain("<BRAIN_PATH>");
	});
});

// ---------------------------------------------------------------------------
// Research-index section ships structural seed
// ---------------------------------------------------------------------------

describe("Research-index section ships structural seed", () => {
	it("researchIndex contains the H1 title '# Research'", async () => {
		const content = await getTemplate();
		const result = parseBrainAideFromString(content);

		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return;

		expect(result.researchIndex).toContain("# Research");
	});

	it("researchIndex contains '### Domains' (nested heading at H3)", async () => {
		const content = await getTemplate();
		const result = parseBrainAideFromString(content);

		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return;

		expect(result.researchIndex).toContain("### Domains");
	});

	it("researchIndex contains '### Domain Hubs'", async () => {
		const content = await getTemplate();
		const result = parseBrainAideFromString(content);

		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return;

		expect(result.researchIndex).toContain("### Domain Hubs");
	});

	it("researchIndex does NOT contain '## Domains' at the start of a line", async () => {
		const content = await getTemplate();
		const result = parseBrainAideFromString(content);

		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return;

		expect(result.researchIndex).not.toMatch(/^## Domains$/m);
	});

	it("researchIndex does NOT contain '## Domain Hubs' at the start of a line", async () => {
		const content = await getTemplate();
		const result = parseBrainAideFromString(content);

		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return;

		expect(result.researchIndex).not.toMatch(/^## Domain Hubs$/m);
	});

	it("researchIndex has no top-level '## ' heading at all", async () => {
		const content = await getTemplate();
		const result = parseBrainAideFromString(content);

		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return;

		expect(result.researchIndex).not.toMatch(/^## .+$/m);
	});
});

// ---------------------------------------------------------------------------
// No nested '## ' headings inside orientation or researchIndex sections
// ---------------------------------------------------------------------------

describe("no nested '## ' headings inside orientation or researchIndex sections", () => {
	it("orientation contains no '^## .+$' lines", async () => {
		const content = await getTemplate();
		const result = parseBrainAideFromString(content);

		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return;

		expect(result.orientation).not.toMatch(/^## .+$/m);
	});

	it("researchIndex contains no '^## .+$' lines", async () => {
		const content = await getTemplate();
		const result = parseBrainAideFromString(content);

		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return;

		expect(result.researchIndex).not.toMatch(/^## .+$/m);
	});
});

// ---------------------------------------------------------------------------
// Parsed frontmatter contains exactly the new flat fields
// ---------------------------------------------------------------------------

describe("parsed frontmatter contains exactly the new flat fields", () => {
	it("name is obsidian", async () => {
		const content = await getTemplate();
		const result = parseBrainAideFromString(content);

		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return;

		expect(result.name).toBe("obsidian");
	});

	it("mcpServerConfig.command is a non-empty string", async () => {
		const content = await getTemplate();
		const result = parseBrainAideFromString(content);

		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return;

		expect(typeof result.mcpServerConfig.command).toBe("string");
		expect(result.mcpServerConfig.command.length).toBeGreaterThan(0);
	});

	it("mcpServerConfig.args is a non-empty array with null at the last (path) slot", async () => {
		const content = await getTemplate();
		const result = parseBrainAideFromString(content);

		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return;

		const { args } = result.mcpServerConfig;
		expect(Array.isArray(args)).toBe(true);
		expect(args.length).toBeGreaterThan(0);
		// Last element is null — the unwired-path slot
		expect(args[args.length - 1]).toBeNull();
	});

	it("result has no connector, rootPath, entryFile, or tools keys on the ok variant", async () => {
		const content = await getTemplate();
		const result = parseBrainAideFromString(content);

		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return;

		expect(Object.prototype.hasOwnProperty.call(result, "connector")).toBe(false);
		expect(Object.prototype.hasOwnProperty.call(result, "rootPath")).toBe(false);
		expect(Object.prototype.hasOwnProperty.call(result, "entryFile")).toBe(false);
		expect(Object.prototype.hasOwnProperty.call(result, "tools")).toBe(false);
	});
});

// ---------------------------------------------------------------------------
// Platform branching — Windows
// ---------------------------------------------------------------------------

describe("platform branching — Windows", () => {
	it("command is cmd on win32", async () => {
		const content = await getTemplate("win32");
		const result = parseBrainAideFromString(content);

		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return;

		expect(result.mcpServerConfig.command).toBe("cmd");
	});

	it("args deep-equal ['/c', 'npx', '-y', '@bitbonsai/mcpvault@0.16.0', null] on win32", async () => {
		const content = await getTemplate("win32");
		const result = parseBrainAideFromString(content);

		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return;

		expect(result.mcpServerConfig.args).toEqual(["/c", "npx", "-y", "@bitbonsai/mcpvault@0.16.0", null]);
	});
});

// ---------------------------------------------------------------------------
// Platform branching — POSIX
// ---------------------------------------------------------------------------

describe("platform branching — POSIX", () => {
	it("command is npx on linux", async () => {
		const content = await getTemplate("posix");
		const result = parseBrainAideFromString(content);

		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return;

		expect(result.mcpServerConfig.command).toBe("npx");
	});

	it("args deep-equal ['-y', '@bitbonsai/mcpvault@0.16.0', null] on linux", async () => {
		const content = await getTemplate("posix");
		const result = parseBrainAideFromString(content);

		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return;

		expect(result.mcpServerConfig.args).toEqual(["-y", "@bitbonsai/mcpvault@0.16.0", null]);
	});
});

// ---------------------------------------------------------------------------
// Orientation body uses storage-agnostic vocabulary and lists its entry-point artifacts
// ---------------------------------------------------------------------------

describe("orientation body uses storage-agnostic vocabulary and lists its entry-point artifacts", () => {
	it("orientation is non-empty", async () => {
		const content = await getTemplate();
		const result = parseBrainAideFromString(content);

		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return;

		expect(result.orientation.trim().length).toBeGreaterThan(0);
	});

	it("orientation contains mcp__brain__read_note", async () => {
		const content = await getTemplate();
		const result = parseBrainAideFromString(content);

		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return;

		expect(result.orientation).toContain("mcp__brain__read_note");
	});

	it("orientation contains mcp__brain__search_notes", async () => {
		const content = await getTemplate();
		const result = parseBrainAideFromString(content);

		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return;

		expect(result.orientation).toContain("mcp__brain__search_notes");
	});

	it("orientation contains coding-playbook/coding-playbook.md", async () => {
		const content = await getTemplate();
		const result = parseBrainAideFromString(content);

		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return;

		expect(result.orientation).toContain("coding-playbook/coding-playbook.md");
	});

	it("orientation contains coding-playbook/study-playbook.md", async () => {
		const content = await getTemplate();
		const result = parseBrainAideFromString(content);

		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return;

		expect(result.orientation).toContain("coding-playbook/study-playbook.md");
	});

	it("orientation contains coding-playbook/update-playbook.md (new fourth entry-point artifact)", async () => {
		const content = await getTemplate();
		const result = parseBrainAideFromString(content);

		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return;

		expect(result.orientation).toContain("coding-playbook/update-playbook.md");
	});

	it("orientation contains research/research.md", async () => {
		const content = await getTemplate();
		const result = parseBrainAideFromString(content);

		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return;

		expect(result.orientation).toContain("research/research.md");
	});

	it("orientation does not contain the word 'vault'", async () => {
		const content = await getTemplate();
		const result = parseBrainAideFromString(content);

		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return;

		expect(result.orientation).not.toMatch(/\bvault\b/i);
	});

	it("orientation does not contain the word 'wikilink'", async () => {
		const content = await getTemplate();
		const result = parseBrainAideFromString(content);

		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return;

		expect(result.orientation).not.toMatch(/\bwikilinks?\b/i);
	});

	it("orientation does not contain the standalone word 'hub'", async () => {
		const content = await getTemplate();
		const result = parseBrainAideFromString(content);

		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return;

		expect(result.orientation).not.toMatch(/\bhub\b/i);
	});
});

// ---------------------------------------------------------------------------
// interpolateArgs is a no-op on the default scaffold
// ---------------------------------------------------------------------------

describe("interpolateArgs is a no-op on the default scaffold", () => {
	it("interpolated args deep-equal original args — null preserved at path slot", async () => {
		const content = await getTemplate();
		const result = parseBrainAideFromString(content);

		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return;

		const brainAideConfig: BrainAideConfig = { name: result.name, mcpServerConfig: result.mcpServerConfig };
		const interpolated = interpolateArgs(brainAideConfig);
		expect(interpolated).toEqual(result.mcpServerConfig.args);
	});

	it("no arg element matches the ${...} regex (null is not an interpolation target)", async () => {
		const content = await getTemplate();
		const result = parseBrainAideFromString(content);

		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return;

		for (const arg of result.mcpServerConfig.args) {
			if (arg !== null) {
				expect(arg).not.toMatch(/\$\{.+\}/);
			}
		}
	});

	it("interpolateArgs does not mutate the parsed config args", async () => {
		const content = await getTemplate();
		const result = parseBrainAideFromString(content);

		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return;

		const brainAideConfig: BrainAideConfig = { name: result.name, mcpServerConfig: result.mcpServerConfig };
		const originalArgs = [...result.mcpServerConfig.args];
		interpolateArgs(brainAideConfig);
		expect(result.mcpServerConfig.args).toEqual(originalArgs);
	});
});

// ---------------------------------------------------------------------------
// Schema does not include intent-spec or deprecated fields
// ---------------------------------------------------------------------------

describe("schema does not include intent-spec or deprecated fields", () => {
	it("content.split('\\n---\\n') yields at least frontmatter + body", async () => {
		const content = await getTemplate();

		expect(content.split("\n---\n").length).toBeGreaterThanOrEqual(2);
	});

	it("frontmatter block contains name and mcpServerConfig", async () => {
		const content = await getTemplate();
		const frontmatterBlock = content.split("\n---\n")[0];

		expect(frontmatterBlock).toMatch(/^name:/m);
		expect(frontmatterBlock).toMatch(/^mcpServerConfig:/m);
	});

	it("frontmatter block does not contain intent-spec fields", async () => {
		const content = await getTemplate();
		const frontmatterBlock = content.split("\n---\n")[0];

		expect(frontmatterBlock).not.toMatch(/^scope:/m);
		expect(frontmatterBlock).not.toMatch(/^outcomes:/m);
		expect(frontmatterBlock).not.toMatch(/^intent:/m);
		expect(frontmatterBlock).not.toMatch(/^status:/m);
	});

	it("frontmatter block does not contain deprecated schema fields", async () => {
		const content = await getTemplate();
		const frontmatterBlock = content.split("\n---\n")[0];

		expect(frontmatterBlock).not.toMatch(/^connector:/m);
		expect(frontmatterBlock).not.toMatch(/^rootPath:/m);
		expect(frontmatterBlock).not.toMatch(/^entryFile:/m);
		expect(frontmatterBlock).not.toMatch(/^tools:/m);
	});
});


// ---------------------------------------------------------------------------
// Kanban seed sections: board, index and the seven operation guides
// ---------------------------------------------------------------------------

type KanbanField = Extract<(typeof brainContract)[number]["field"], `kanban${string}`>;

/** The nine kanban contract fields, board first. */
const KANBAN_FIELDS = brainContract.map(({ field }) => field).filter((field): field is KanbanField => field.startsWith("kanban"));

/** The seven operation guides: contract field, `# ` title, and the outline brief commitment #5 fixes. */
const GUIDES: ReadonlyArray<{ field: KanbanField; title: string; outline: string[] }> = [
	{
		field: "kanbanCreate",
		title: "Create",
		outline: [
			"# Create",
			"## Delegation rules",
			"## Step 1 — Gather card details",
			"## Step 2 — Create the card",
			"## Step 3 — Confirm and clear",
		],
	},
	{
		field: "kanbanWork",
		title: "Work",
		outline: [
			"# Work",
			"## Architecture",
			"## Mode discipline",
			"## Checklist",
			"## Step 0 — Enter planning mode",
			"## Step 1 — Spawn a board subagent: find cards",
			"## Step 2 — Present and pick",
			"## Step 3 — Deferred",
			"## Step 4 — Investigate and plan (main agent, planning mode)",
			"### 4a — Load conventions",
			"### 4b — Load context",
			"### 4c — Investigate the codebase",
			"### 4d — Devise the plan",
			"### 4e — Open questions (if any)",
			"## Step 5 — Hard stop: present the plan",
			"## Step 5b — Spawn a board subagent: activate the card",
			"## Step 6 — Implement (main agent, act mode)",
			"### 6a — Implement the changes",
			"### 6b — Type check",
			"### 6c — Write and run tests",
			"## Step 7 — Review (main agent, planning mode)",
			"### 7a — Get the diff",
			"### 7b — Read the changed files in full",
			"### 7c — Review against each criterion",
			"### 7d — Produce the review",
			"### 7e — Present the review and check the verdict",
			"## Step 8 — Revision loop (forward-only)",
			"### 8a — Re-investigate (planning mode)",
			"### 8b — Implement the revisions (act mode)",
			"### 8c — Re-review (planning mode)",
			"### 8d — Present and check the verdict",
		],
	},
	{
		field: "kanbanManage",
		title: "Manage",
		outline: [
			"# Manage",
			"## Step 1 — Determine the project",
			"## Step 2 — Read the board",
			"### Reconciliation check",
			"## Step 3 — Present cards and prompt for action",
			"## Step 4 — Move the card",
			"### 4a — Update the board",
			"### 4b — Move the card file",
			"## Step 5 — Confirm",
		],
	},
	{
		field: "kanbanMove",
		title: "Move",
		outline: [
			"# Move",
			"## Step 1 — Parse the target column",
			"## Step 2 — Identify the card from session context",
			"## Step 3 — Determine the project",
			"## Step 4 — Read the board",
			"## Step 5 — Move the card",
			"### 5a — Update the board",
			"### 5b — Move the card file",
			"## Step 6 — Confirm",
		],
	},
	{
		field: "kanbanComplete",
		title: "Complete",
		outline: [
			"# Complete",
			"## Step 1 — Parse flags",
			"## Step 2 — Identify the card from session context",
			"## Step 3 — Determine the project",
			"## Step 4 — Read the board",
			"## Step 5 — Move the card",
			"### 5a — Update the board",
			"### 5b — Move the card file",
			"## Step 6 — Confirm",
		],
	},
	{
		field: "kanbanStash",
		title: "Stash",
		outline: [
			"# Stash",
			"## Step 1 — Identify the card from session context",
			"## Step 2 — Determine the project",
			"## Step 3 — Read the card",
			"## Step 4 — Gather session context",
			"### 4a — Git changes (if in a git repo)",
			"### 4b — Conversation review",
			"## Step 5 — Compose and append the stash entry",
			"## Step 6 — Update frontmatter",
			"## Step 7 — Confirm",
		],
	},
	{
		field: "kanbanReview",
		title: "Review",
		outline: [
			"# Review",
			"## Delegation rules",
			"## Step 1 — Run the review",
			"## Step 2 — Present the review",
			"## Step 3 — Record the review",
			"## Step 4 — Fix cycle (only if changes were requested)",
			"### 4a — Investigate the findings",
			"### 4b — Present the plan and handle open questions",
			"### 4c — Implement the fixes",
			"### 4d — Present results",
		],
	},
];

/** The operations in contract order, as the index's `[[kanban/guide/<op>|` links name them. */
const OPERATIONS = ["create", "work", "manage", "move", "complete", "stash", "review"];

/** Headings the index owns; no guide may restate them. */
const SHARED_HEADINGS = ["## Board and Columns", "## Cards", "## Project Tag", "## Reaching the Board"];

/** Tokens that identified the user's own projects in the source guide (brief commitment #6). */
const PROJECT_SPECIFIC_TOKENS = [
	"tetsukodai",
	"tetsukod.ai",
	"cold-outreach-analyzer",
	"aidemd",
	"apollo",
	"brain-contract-and-create-repair-command",
];

/** The orientation's final paragraph (brief commitment #8), spelled out independently of the template. */
const ORIENTATION_POINTER =
	"Project work is tracked on the kanban board at `kanban/board.md`. Before any board operation, read the kanban index at `kanban/kanban.md`, then read only the guide it links for the operation you are performing.";

/** Parses the template and returns the ok result, failing the test if the template does not parse. */
async function parseTemplate() {
	const result = parseBrainAideFromString(await getTemplate());
	if (result.kind !== "ok") throw new Error(`template did not parse: ${result.kind}`);
	return result;
}

/** Returns the `---` frontmatter block of a seed section, without its fences, or null when the section has none. */
function readFrontmatter(section: string): string | null {
	const trimmed = section.trimStart();
	if (!trimmed.startsWith("---\n")) return null;
	const end = trimmed.indexOf("\n---\n", 3);
	return end === -1 ? null : trimmed.slice(4, end);
}

/** Returns the section text after its frontmatter block. */
function readBody(section: string): string {
	const trimmed = section.trimStart();
	return trimmed.slice(trimmed.indexOf("\n---\n", 3) + 5);
}

/** Returns the column-0 heading lines of a markdown text, skipping fenced code blocks and blockquoted lines. */
function extractOutline(text: string): string[] {
	const headings: string[] = [];
	let inFence = false;
	for (const line of text.split("\n")) {
		if (line.trimStart().startsWith("```")) {
			inFence = !inFence;
			continue;
		}
		if (inFence || line.startsWith(">")) continue;
		if (/^#{1,6} /.test(line)) headings.push(line);
	}
	return headings;
}

describe("kanbanBoard section ships the empty Kanban-plugin board", () => {
	it("contains the five column headings in order", async () => {
		const result = await parseTemplate();

		const columns = ["## Backlog", "## Todo", "## In Progress", "## In Review", "## Done"];
		const positions = columns.map((heading) => result.kanbanBoard.indexOf(`\n${heading}\n`));
		for (const position of positions) expect(position).toBeGreaterThan(-1);
		expect([...positions].sort((a, b) => a - b)).toEqual(positions);
	});

	it("is the exact bytes of brief commitment #3, wrapped as the marker pair emits them", async () => {
		const result = await parseTemplate();

		const fence = "```";
		const seed =
			"---\nkanban-plugin: list\ntags:\n  - tasks\n---\n\n\n\n" +
			"## Backlog\n\n\n\n## Todo\n\n\n\n## In Progress\n\n\n\n## In Review\n\n\n\n## Done\n\n\n\n" +
			`%% kanban:settings\n${fence}\n{"kanban-plugin":"list"}\n${fence}\n%%\n`;
		expect(result.kanbanBoard).toBe("\n\n" + seed + "\n");
	});

	it("opens with the kanban-plugin frontmatter and carries no prose before '## Backlog'", async () => {
		const result = await parseTemplate();

		expect(readFrontmatter(result.kanbanBoard)).toContain("kanban-plugin: list");
		const beforeFirstColumn = readBody(result.kanbanBoard).split("## Backlog")[0] ?? "";
		expect(beforeFirstColumn.trim()).toBe("");
	});

	it("ends with the '%% kanban:settings' block holding the kanban-plugin list setting", async () => {
		const result = await parseTemplate();

		const settingsStart = result.kanbanBoard.indexOf("%% kanban:settings");
		expect(settingsStart).toBeGreaterThan(-1);
		const settings = result.kanbanBoard.slice(settingsStart);
		expect(settings).toContain('{"kanban-plugin":"list"}');
		expect(settings.trimEnd().endsWith("%%")).toBe(true);
		expect(settings).not.toContain("## ");
	});
});

describe("kanbanIndex section ships the shared rules and the operations list", () => {
	it("opens with frontmatter tagged tasks, workflow, hub", async () => {
		const result = await parseTemplate();

		expect(readFrontmatter(result.kanbanIndex)).toBe("tags:\n  - tasks\n  - workflow\n  - hub");
	});

	it("has the '# Kanban' title directly after the frontmatter", async () => {
		const result = await parseTemplate();

		expect(readBody(result.kanbanIndex).startsWith("# Kanban\n")).toBe(true);
	});

	it("contains the shared-rule headings in order", async () => {
		const result = await parseTemplate();

		const headings = ["## Operations", "## Board and Columns", "## Cards", "## Project Tag", "## Reaching the Board"];
		const positions = headings.map((heading) => result.kanbanIndex.indexOf(`\n${heading}\n`));
		for (const position of positions) expect(position).toBeGreaterThan(-1);
		expect([...positions].sort((a, b) => a - b)).toEqual(positions);
	});

	it.each(OPERATIONS)("links the %s guide", async (operation) => {
		const result = await parseTemplate();

		expect(result.kanbanIndex).toContain(`[[kanban/guide/${operation}|`);
	});

	it("holds no step headings — procedures live in the guides", async () => {
		const result = await parseTemplate();

		expect(result.kanbanIndex).not.toMatch(/^#{2,4} Step\b/m);
	});

	it.each([
		"[[<card-slug>]]",
		"<P#> <TYPE>: <summary>",
		"p3",
		"Related: [[projects/<project-note>|<display-name>]]",
		"%% kanban:settings",
		"kanban-plugin: list",
		"mcp__brain__read_note_lines",
		"mcp__brain__move_note",
	])("keeps the Obsidian convention anchor %s", async (anchor) => {
		const result = await parseTemplate();

		expect(result.kanbanIndex).toContain(anchor);
	});
});

describe.each(GUIDES)("$field guide", ({ field, title, outline }) => {
	it("opens with frontmatter tagged tasks, workflow", async () => {
		const result = await parseTemplate();

		expect(readFrontmatter(result[field])).toBe("tags:\n  - tasks\n  - workflow");
	});

	it("has its operation title as the first heading", async () => {
		const result = await parseTemplate();

		expect(extractOutline(readBody(result[field]))[0]).toBe(`# ${title}`);
	});

	it("links back to the index with the fixed 'Part of' line", async () => {
		const result = await parseTemplate();

		expect(result[field]).toContain("Part of [[kanban/kanban|Kanban]].");
	});

	it("has exactly the brief commitment #5 heading outline, in order", async () => {
		const result = await parseTemplate();

		expect(extractOutline(readBody(result[field]))).toEqual(outline);
	});

	it.each(SHARED_HEADINGS)("does not restate the index's %s", async (heading) => {
		const result = await parseTemplate();

		expect(result[field]).not.toContain(`\n${heading}\n`);
	});
});

describe("return-format and gate anchors live in the guide that owns them", () => {
	it.each([
		["kanbanCreate", ["CREATED:", "MODE: NO_PROJECT", "PROJECT_NOTE: none", "omit the `Related:` line"]],
		[
			"kanbanWork",
			[
				"MODE: DIRECT",
				"MODE: TABLE",
				"MODE: NO_TASKS",
				"MISMATCHES:",
				"Hard stop. Do not activate the board or write code until the user approves the plan.",
				"DONE (resumed)",
				"VERDICT: LGTM | CHANGES_REQUESTED | NEEDS_DISCUSSION",
				"run the [[kanban/guide/stash|Stash]] operation",
			],
		],
		["kanbanManage", ["Reconciliation check", "[[kanban/kanban|Kanban]]"]],
		[
			"kanbanReview",
			["**Verdict:** LGTM | Changes Requested | Needs Discussion", "INVESTIGATION:", "SUMMARY:", "Do NOT commit"],
		],
	] as const)("%s contains its anchors", async (field, anchors) => {
		const result = await parseTemplate();

		for (const anchor of anchors) expect(result[field]).toContain(anchor);
	});

	it("kanbanStash keeps the entry format unpromoted inside its fence", async () => {
		const result = await parseTemplate();

		const fenced = result.kanbanStash.split("```markdown")[1] ?? "";
		expect(fenced).toContain("\n## Stash\n");
		expect(fenced).toContain("### <YYYY-MM-DD HH:MM>");
	});
});

describe("every kanban section is project-neutral and standalone", () => {
	it.each(KANBAN_FIELDS)("%s carries no project-specific token", async (field) => {
		const result = await parseTemplate();

		for (const token of PROJECT_SPECIFIC_TOKENS) expect(result[field].toLowerCase()).not.toContain(token);
	});

	it.each(KANBAN_FIELDS)("%s works in non-AIDE projects: no aide_brain, no .aide/, no orientation reference", async (field) => {
		const result = await parseTemplate();

		expect(result[field]).not.toContain("aide_brain");
		expect(result[field]).not.toContain(".aide/");
		expect(result[field]).not.toMatch(/orientation/i);
	});

	it.each(KANBAN_FIELDS)("%s has no feature-linking section and no feature field", async (field) => {
		const result = await parseTemplate();

		expect(result[field]).not.toContain("## Link a Card to a Feature");
		expect(result[field]).not.toContain("feature:");
	});
});

describe("orientation points at the kanban board and its index", () => {
	it("ends with the exact pointer paragraph of brief commitment #8", async () => {
		const result = await parseTemplate();

		const paragraphs = result.orientation.trim().split("\n\n");
		expect(paragraphs[paragraphs.length - 1]).toBe(ORIENTATION_POINTER);
	});

	it("names kanban/board.md and kanban/kanban.md, and not the retired kanban/work-kanban.md", async () => {
		const result = await parseTemplate();

		expect(result.orientation).toContain("kanban/board.md");
		expect(result.orientation).toContain("kanban/kanban.md");
		expect(result.orientation).not.toContain("kanban/work-kanban.md");
	});

	it("keeps exactly two paragraphs", async () => {
		const result = await parseTemplate();

		expect(result.orientation.trim().split("\n\n")).toHaveLength(2);
	});
});

describe("config section seeds frontmatter-bearing sections correctly", () => {
	it("tells the agent to split a leading frontmatter block into the tool's frontmatter argument", async () => {
		const result = await parseTemplate();

		expect(result.config).toContain("pass that block's fields as the tool's `frontmatter` argument");
	});

	it("still names no seed path", async () => {
		const result = await parseTemplate();

		for (const entry of brainContract) if (entry.role === "seed") expect(result.config).not.toContain(entry.seedPath);
	});
});

// ---------------------------------------------------------------------------
// Launch mode — global launcher, pinned local launcher, config-prose agreement
// ---------------------------------------------------------------------------

/** Parses a template emission and returns its ok result, failing the test if it does not parse. */
function parseOk(content: string) {
	const result = parseBrainAideFromString(content);
	if (result.kind !== "ok") throw new Error(`template did not parse: ${result.kind}`);
	return result;
}

describe("launch mode — global launcher", () => {
	it("on POSIX: command is mcpvault and args deep-equal [null]", async () => {
		const result = parseOk(await getTemplate("posix", "global"));

		expect(result.mcpServerConfig.command).toBe("mcpvault");
		expect(result.mcpServerConfig.args).toEqual([null]);
	});

	it("on win32: command is the bare mcpvault (probe outcome A, brief #20) and args deep-equal [null]", async () => {
		const result = parseOk(await getTemplate("win32", "global"));

		expect(result.mcpServerConfig.command).toBe("mcpvault");
		expect(result.mcpServerConfig.args).toEqual([null]);
	});

	it.each(["posix", "win32"] as const)("on %s: still parses ok and the last args entry is null", async (platformName) => {
		const result = parseOk(await getTemplate(platformName, "global"));

		const { args } = result.mcpServerConfig;
		expect(args[args.length - 1]).toBeNull();
	});
});

describe("launch mode — local launcher", () => {
	it.each(["posix", "win32"] as const)("on %s: args contain -y and never @latest", async (platformName) => {
		const result = parseOk(await getTemplate(platformName, "local"));

		expect(result.mcpServerConfig.args).toContain("-y");
		for (const arg of result.mcpServerConfig.args) expect(arg ?? "").not.toContain("@latest");
	});

	it.each(["posix", "win32"] as const)("on %s: an omitted mode is byte-identical to local", async (platformName) => {
		expect(await getTemplate(platformName)).toBe(await getTemplate(platformName, "local"));
	});
});

describe("config section prose for the brain launch mode", () => {
	it("names the global-install check, the install offer, the local fallback and the absolute-path rule", async () => {
		const result = parseOk(await getTemplate());

		expect(result.config).toContain("npm ls -g @bitbonsai/mcpvault --depth=0");
		expect(result.config).toContain("npm i -g @bitbonsai/mcpvault");
		expect(result.config).toContain("Use local launch instead");
		expect(result.config).toContain("A global launcher given by absolute path is valid");
	});

	it("carries the pin-forward offer with the pinned spec in both insertions", async () => {
		const result = parseOk(await getTemplate());

		expect(result.config).toContain("offer with `AskUserQuestion` to update it to `-y @bitbonsai/mcpvault@0.16.0`");
		expect(result.config).toContain("offer to move an unpinned, `@latest` or older pin to `@bitbonsai/mcpvault@0.16.0`");
	});

	it("every version in the prose equals the launcher's version", async () => {
		const result = parseOk(await getTemplate("posix", "local"));

		const launcherSpec = result.mcpServerConfig.args.find((arg) => arg?.startsWith("@bitbonsai/mcpvault@"));
		const launcherVersion = launcherSpec?.split("@").pop();
		expect(launcherVersion).toMatch(/^\d+\.\d+\.\d+$/);

		const proseVersions = [...result.config.matchAll(/@bitbonsai\/mcpvault@(\d+\.\d+\.\d+)/g)].map((match) => match[1]);
		const olderThan = [...result.config.matchAll(/older than `(\d+\.\d+\.\d+)`/g)].map((match) => match[1]);
		expect(proseVersions.length).toBeGreaterThanOrEqual(4);
		for (const version of [...proseVersions, ...olderThan]) expect(version).toBe(launcherVersion);
	});
});
