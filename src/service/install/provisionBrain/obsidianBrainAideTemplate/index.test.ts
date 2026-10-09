import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import brainContract from "@/service/brainContract/index.js";
import parseBrainAide, { parseBrainAideFromString, interpolateArgs } from "@/service/parseBrainAide/index.js";
import type { BrainAideConfig } from "@/types/index.js";

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

async function getTemplate(mockedPlatform?: "win32" | "posix"): Promise<string> {
	const { platform } = await import("node:os");
	if (mockedPlatform !== undefined) {
		vi.mocked(platform).mockReturnValue(mockedPlatform === "win32" ? "win32" : "linux");
	}
	const { default: obsidianBrainAideTemplate } = await import("./index.js");
	return obsidianBrainAideTemplate();
}

async function writeBrainAide(root: string, content: string): Promise<void> {
	await mkdir(join(root, ".aide", "config"), { recursive: true });
	await writeFile(join(root, ".aide", "config", "brain.aide"), content, "utf-8");
}

// ---------------------------------------------------------------------------
// path slot is YAML null in every emission
// ---------------------------------------------------------------------------

describe("path slot is YAML null in every emission", () => {
	it("on POSIX: parsed args at index 1 is exactly null", async () => {
		const content = await getTemplate("posix");
		const result = parseBrainAideFromString(content);

		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return;

		expect(result.mcpServerConfig.args[1]).toBeNull();
	});

	it("on win32: parsed args at index 3 is exactly null", async () => {
		const content = await getTemplate("win32");
		const result = parseBrainAideFromString(content);

		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return;

		expect(result.mcpServerConfig.args[3]).toBeNull();
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

		// null at args[1] for POSIX — must be null, not "" and not absent
		expect(interpolated[1]).toBeNull();
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
// Eight-section body shape
// ---------------------------------------------------------------------------

describe("eight-section body shape", () => {
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
		expect(sections).toHaveLength(8);

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

	it("args deep-equal ['/c', 'npx', '@bitbonsai/mcpvault', null] on win32", async () => {
		const content = await getTemplate("win32");
		const result = parseBrainAideFromString(content);

		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return;

		expect(result.mcpServerConfig.args).toEqual(["/c", "npx", "@bitbonsai/mcpvault", null]);
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

	it("args deep-equal ['@bitbonsai/mcpvault', null] on linux", async () => {
		const content = await getTemplate("posix");
		const result = parseBrainAideFromString(content);

		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return;

		expect(result.mcpServerConfig.args).toEqual(["@bitbonsai/mcpvault", null]);
	});
});

// ---------------------------------------------------------------------------
// Orientation body uses storage-agnostic vocabulary and lists all four entry-point artifacts
// ---------------------------------------------------------------------------

describe("orientation body uses storage-agnostic vocabulary and lists all four entry-point artifacts", () => {
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
// Kanban seed sections: board bytes, full-port guide, backend-agnostic vocabulary
// ---------------------------------------------------------------------------

/** Case-insensitive patterns the kanban seed bytes must never match (brief commitment #4). */
const BANNED_PATTERNS: RegExp[] = [
	/\bvault\b/i,
	/\bobsidian\b/i,
	/\bnotes?\b/i,
	/wikilink/i,
	/\bhubs?\b/i,
	/\[\[/,
	/mcp__/i,
	/kanban-plugin/i,
];

/** The `##` section headings of the work-kanban guide, in the order brief commitment #3 fixes. */
const GUIDE_HEADINGS = [
	"## Board and Columns",
	"## Cards",
	"## Project Tag",
	"## Create",
	"## Work",
	"## Manage",
	"## Move",
	"## Complete",
	"## Stash",
	"## Review",
	"## Reaching the Board",
];

describe("kanbanBoard section ships the empty five-column board", () => {
	it("contains the five column headings in order", async () => {
		const result = parseBrainAideFromString(await getTemplate());
		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return;

		const columns = ["## Backlog", "## Todo", "## In Progress", "## In Review", "## Done"];
		const positions = columns.map((heading) => result.kanbanBoard.indexOf(`\n${heading}\n`));
		for (const position of positions) expect(position).toBeGreaterThan(-1);
		expect([...positions].sort((a, b) => a - b)).toEqual(positions);
	});

	it("is the exact bytes of brief commitment #2", async () => {
		const result = parseBrainAideFromString(await getTemplate());
		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return;

		expect(result.kanbanBoard).toBe(
			"\n\n# Kanban Board\n\n" +
				"Cards are listed under their column, one per line, as `- [ ] <card-slug> — <title> #<project-tag>`. Cards in Done use `- [x]`. The guide at `kanban/work-kanban.md` defines every board operation.\n\n" +
				"## Backlog\n\n## Todo\n\n## In Progress\n\n## In Review\n\n## Done\n\n",
		);
	});

	it("carries no frontmatter and no plugin-specific keys", async () => {
		const result = parseBrainAideFromString(await getTemplate());
		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return;

		expect(result.kanbanBoard.trimStart().startsWith("---")).toBe(false);
		expect(result.kanbanBoard).not.toMatch(/^kanban-plugin:/m);
	});
});

describe("workKanban section ships the full-port guide", () => {
	it("starts with the '# Work Kanban' title", async () => {
		const result = parseBrainAideFromString(await getTemplate());
		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return;

		expect(result.workKanban.trimStart().startsWith("# Work Kanban\n")).toBe(true);
	});

	it("contains every '##' section heading from brief commitment #3, in order", async () => {
		const result = parseBrainAideFromString(await getTemplate());
		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return;

		const positions = GUIDE_HEADINGS.map((heading) => result.workKanban.indexOf(`\n${heading}\n`));
		for (const position of positions) expect(position).toBeGreaterThan(-1);
		expect([...positions].sort((a, b) => a - b)).toEqual(positions);
	});

	it("has no feature-linking section and no feature field", async () => {
		const result = parseBrainAideFromString(await getTemplate());
		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return;

		expect(result.workKanban).not.toContain("## Link a Card to a Feature");
		expect(result.workKanban).not.toMatch(/feature:/i);
	});

	it("works in non-AIDE projects: no aide_brain, no .aide/, no orientation reference", async () => {
		const result = parseBrainAideFromString(await getTemplate());
		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return;

		expect(result.workKanban).not.toContain("aide_brain");
		expect(result.workKanban).not.toContain(".aide/");
		expect(result.workKanban).not.toMatch(/orientation/i);
	});

	it("keeps the approval hard stops and the return formats of the work procedure", async () => {
		const result = parseBrainAideFromString(await getTemplate());
		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return;

		for (const anchor of [
			"MODE: DIRECT",
			"MODE: TABLE",
			"MODE: NO_TASKS",
			"MODE: NO_PROJECT",
			"MISMATCHES:",
			"Hard stop. Do not activate the board or write code until the user approves the plan.",
			"DONE (resumed)",
			"VERDICT: LGTM | CHANGES_REQUESTED | NEEDS_DISCUSSION",
			"CREATED:",
			"**Verdict:** LGTM | Changes Requested | Needs Discussion",
			"INVESTIGATION:",
			"SUMMARY:",
		]) {
			expect(result.workKanban).toContain(anchor);
		}
	});
});

describe("kanban seed bytes are backend-agnostic (brief commitment #4)", () => {
	it.each(BANNED_PATTERNS.map((pattern) => [pattern.source, pattern] as const))(
		"kanbanBoard and workKanban do not match /%s/i",
		async (_source, pattern) => {
			const result = parseBrainAideFromString(await getTemplate());
			expect(result.kind).toBe("ok");
			if (result.kind !== "ok") return;

			expect(result.kanbanBoard).not.toMatch(pattern);
			expect(result.workKanban).not.toMatch(pattern);
		},
	);

	it("the orientation pointer sentence satisfies the same vocabulary rule", async () => {
		const result = parseBrainAideFromString(await getTemplate());
		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return;

		const pointer =
			"Project work is tracked on the kanban board at `kanban/board.md`; follow the guide at `kanban/work-kanban.md` to create, work, move, complete, stash, or review cards.";
		expect(result.orientation).toContain(`${pointer}\n\n`);
		for (const pattern of BANNED_PATTERNS) expect(pointer).not.toMatch(pattern);
	});
});

describe("orientation points at the kanban board and its guide", () => {
	it("contains kanban/board.md and kanban/work-kanban.md", async () => {
		const result = parseBrainAideFromString(await getTemplate());
		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return;

		expect(result.orientation).toContain("kanban/board.md");
		expect(result.orientation).toContain("kanban/work-kanban.md");
	});

	it("keeps the pointer as its own final paragraph", async () => {
		const result = parseBrainAideFromString(await getTemplate());
		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return;

		const paragraphs = result.orientation.trim().split("\n\n");
		expect(paragraphs).toHaveLength(2);
		expect(paragraphs[1]?.startsWith("Project work is tracked on the kanban board")).toBe(true);
	});
});
