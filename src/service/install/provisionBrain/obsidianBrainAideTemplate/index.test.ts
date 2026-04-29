import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
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

async function getTemplate(brainPath?: string, mockedPlatform?: "win32" | "posix"): Promise<string> {
	const { platform } = await import("node:os");
	if (mockedPlatform !== undefined) {
		vi.mocked(platform).mockReturnValue(mockedPlatform === "win32" ? "win32" : "linux");
	}
	const { default: obsidianBrainAideTemplate } = await import("./index.js");
	return obsidianBrainAideTemplate(brainPath);
}

async function writeBrainAide(root: string, content: string): Promise<void> {
	await mkdir(join(root, ".aide", "config"), { recursive: true });
	await writeFile(join(root, ".aide", "config", "brain.aide"), content, "utf-8");
}

// ---------------------------------------------------------------------------
// Round-trip parses cleanly under the new schema
// ---------------------------------------------------------------------------

describe("round-trip parses cleanly under the new schema", () => {
	it("template output round-trips through parseBrainAide with kind ok", async () => {
		const brainPath = "/foo/my-vault";
		const content = await getTemplate(brainPath);

		await writeBrainAide(tempDir, content);
		const result = await parseBrainAide(tempDir);

		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return;

		expect(result.name).toBe("obsidian");
		expect(result.playbookIndex.length).toBeGreaterThan(0);
		expect(result.researchIndex.length).toBeGreaterThan(0);
	});

	it("parseBrainAideFromString produces the same ok result as writing to disk", async () => {
		const brainPath = "/foo/my-vault";
		const content = await getTemplate(brainPath);

		await writeBrainAide(tempDir, content);
		const fromDisk = await parseBrainAide(tempDir);
		const fromString = parseBrainAideFromString(content);

		expect(fromDisk.kind).toBe("ok");
		expect(fromString.kind).toBe("ok");
		expect(fromDisk).toEqual(fromString);
	});
});

// ---------------------------------------------------------------------------
// Six-section body shape
// ---------------------------------------------------------------------------

describe("six-section body shape", () => {
	it("result.kind is ok — parser accepts the six-section body grammar", async () => {
		const content = await getTemplate("/foo/my-vault");
		const result = parseBrainAideFromString(content);

		expect(result.kind).toBe("ok");
	});

	it("orientation is a non-empty string", async () => {
		const content = await getTemplate("/foo/my-vault");
		const result = parseBrainAideFromString(content);

		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return;

		expect(typeof result.orientation).toBe("string");
		expect(result.orientation.length).toBeGreaterThan(0);
	});

	it("config is a non-empty string", async () => {
		const content = await getTemplate("/foo/my-vault");
		const result = parseBrainAideFromString(content);

		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return;

		expect(typeof result.config).toBe("string");
		expect(result.config.length).toBeGreaterThan(0);
	});

	it("playbookIndex is a non-empty string", async () => {
		const content = await getTemplate("/foo/my-vault");
		const result = parseBrainAideFromString(content);

		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return;

		expect(typeof result.playbookIndex).toBe("string");
		expect(result.playbookIndex.length).toBeGreaterThan(0);
	});

	it("studyPlaybook is a non-empty string", async () => {
		const content = await getTemplate("/foo/my-vault");
		const result = parseBrainAideFromString(content);

		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return;

		expect(typeof result.studyPlaybook).toBe("string");
		expect(result.studyPlaybook.length).toBeGreaterThan(0);
	});

	it("updatePlaybook is a non-empty string", async () => {
		const content = await getTemplate("/foo/my-vault");
		const result = parseBrainAideFromString(content);

		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return;

		expect(typeof result.updatePlaybook).toBe("string");
		expect(result.updatePlaybook.length).toBeGreaterThan(0);
	});

	it("researchIndex is a non-empty string", async () => {
		const content = await getTemplate("/foo/my-vault");
		const result = parseBrainAideFromString(content);

		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return;

		expect(typeof result.researchIndex).toBe("string");
		expect(result.researchIndex.length).toBeGreaterThan(0);
	});

	it("all six body sections are pairwise byte-distinct", async () => {
		const content = await getTemplate("/foo/my-vault");
		const result = parseBrainAideFromString(content);

		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return;

		const sections = [
			result.orientation,
			result.config,
			result.playbookIndex,
			result.studyPlaybook,
			result.updatePlaybook,
			result.researchIndex,
		];

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
		const content = await getTemplate("/foo/my-vault");
		const result = parseBrainAideFromString(content);

		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return;

		expect(result.playbookIndex).toContain("# Coding Playbook");
	});

	it("playbookIndex contains '## Task Routing' (top-level sub-section under # Coding Playbook)", async () => {
		const content = await getTemplate("/foo/my-vault");
		const result = parseBrainAideFromString(content);

		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return;

		expect(result.playbookIndex).toMatch(/^## Task Routing$/m);
	});

	it("playbookIndex contains '[[your-conventions-note]]'", async () => {
		const content = await getTemplate("/foo/my-vault");
		const result = parseBrainAideFromString(content);

		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return;

		expect(result.playbookIndex).toContain("[[your-conventions-note]]");
	});

	it("playbookIndex contains '[[your-folder-structure-note]]'", async () => {
		const content = await getTemplate("/foo/my-vault");
		const result = parseBrainAideFromString(content);

		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return;

		expect(result.playbookIndex).toContain("[[your-folder-structure-note]]");
	});

	it("playbookIndex contains '## How to Use This Index' (parent for Always Read First)", async () => {
		const content = await getTemplate("/foo/my-vault");
		const result = parseBrainAideFromString(content);

		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return;

		expect(result.playbookIndex).toMatch(/^## How to Use This Index$/m);
	});

	it("playbookIndex does NOT contain procedural Step-1/Step-2/Step-3 narration", async () => {
		const content = await getTemplate("/foo/my-vault");
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
		const content = await getTemplate("/foo/my-vault");
		const result = parseBrainAideFromString(content);

		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return;

		expect(result.studyPlaybook.trimStart().startsWith("# ")).toBe(true);
	});

	it("studyPlaybook contains 'Step 1' procedural marker", async () => {
		const content = await getTemplate("/foo/my-vault");
		const result = parseBrainAideFromString(content);

		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return;

		expect(result.studyPlaybook.includes("Step 1")).toBe(true);
	});

	it("studyPlaybook contains 'Step 2' procedural marker", async () => {
		const content = await getTemplate("/foo/my-vault");
		const result = parseBrainAideFromString(content);

		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return;

		expect(result.studyPlaybook.includes("Step 2")).toBe(true);
	});

	it("studyPlaybook contains 'Step 3' procedural marker", async () => {
		const content = await getTemplate("/foo/my-vault");
		const result = parseBrainAideFromString(content);

		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return;

		expect(result.studyPlaybook.includes("Step 3")).toBe(true);
	});

	it("studyPlaybook contains 'Navigation Rules' heading", async () => {
		const content = await getTemplate("/foo/my-vault");
		const result = parseBrainAideFromString(content);

		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return;

		expect(result.studyPlaybook.includes("Navigation Rules")).toBe(true);
	});

	it("studyPlaybook contains the depth-counting example anchor", async () => {
		const content = await getTemplate("/foo/my-vault");
		const result = parseBrainAideFromString(content);

		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return;

		expect(result.studyPlaybook).toMatch(/depth 0/i);
		expect(result.studyPlaybook).toMatch(/depth 1/i);
	});

	it("studyPlaybook contains the [[wikilink]] literal substring (user-owned-section carve-out)", async () => {
		const content = await getTemplate("/foo/my-vault");
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
		const content = await getTemplate("/foo/my-vault");
		const result = parseBrainAideFromString(content);

		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return;

		expect(result.updatePlaybook.trim().length).toBeGreaterThan(0);
		expect(result.updatePlaybook).toContain("# Update Playbook");
	});

	it("updatePlaybook contains mcp__brain__patch_note (Obsidian connector-specific edit tool)", async () => {
		const content = await getTemplate("/foo/my-vault");
		const result = parseBrainAideFromString(content);

		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return;

		expect(result.updatePlaybook).toContain("mcp__brain__patch_note");
	});

	it("updatePlaybook contains mcp__brain__write_note (Obsidian connector-specific write tool)", async () => {
		const content = await getTemplate("/foo/my-vault");
		const result = parseBrainAideFromString(content);

		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return;

		expect(result.updatePlaybook).toContain("mcp__brain__write_note");
	});

	it("updatePlaybook contains the routing-table drift-check anchor string", async () => {
		const content = await getTemplate("/foo/my-vault");
		const result = parseBrainAideFromString(content);

		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return;

		expect(result.updatePlaybook).toContain("Routing-table drift check");
	});

	it("updatePlaybook is byte-distinct from studyPlaybook", async () => {
		const content = await getTemplate("/foo/my-vault");
		const result = parseBrainAideFromString(content);

		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return;

		expect(result.updatePlaybook).not.toBe(result.studyPlaybook);
	});
});

// ---------------------------------------------------------------------------
// config section ships the Obsidian wiring flow
// ---------------------------------------------------------------------------

describe("config section ships the Obsidian wiring flow", () => {
	it("config is non-empty", async () => {
		const content = await getTemplate("/foo/my-vault");
		const result = parseBrainAideFromString(content);

		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return;

		expect(result.config.trim().length).toBeGreaterThan(0);
	});

	it("config mentions mcpServerConfig.args (the field that carries the vault path)", async () => {
		const content = await getTemplate("/foo/my-vault");
		const result = parseBrainAideFromString(content);

		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return;

		expect(result.config).toContain("mcpServerConfig.args");
	});

	it("config mentions the <BRAIN_PATH> placeholder (detecting the un-wired state)", async () => {
		const content = await getTemplate("/foo/my-vault");
		const result = parseBrainAideFromString(content);

		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return;

		expect(result.config).toContain("<BRAIN_PATH>");
	});

	it("config mentions /aide:brain config (the argument shape for Obsidian wiring)", async () => {
		const content = await getTemplate("/foo/my-vault");
		const result = parseBrainAideFromString(content);

		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return;

		expect(result.config).toContain("/aide:brain config");
	});

	it("config contains a restart-style instruction", async () => {
		const content = await getTemplate("/foo/my-vault");
		const result = parseBrainAideFromString(content);

		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return;

		expect(result.config).toContain("Restart");
	});
});

// ---------------------------------------------------------------------------
// Research-index section ships structural seed
// ---------------------------------------------------------------------------

describe("Research-index section ships structural seed", () => {
	it("researchIndex contains the H1 title '# Research'", async () => {
		const content = await getTemplate("/foo/my-vault");
		const result = parseBrainAideFromString(content);

		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return;

		expect(result.researchIndex).toContain("# Research");
	});

	it("researchIndex contains '### Domains' (nested heading at H3)", async () => {
		const content = await getTemplate("/foo/my-vault");
		const result = parseBrainAideFromString(content);

		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return;

		expect(result.researchIndex).toContain("### Domains");
	});

	it("researchIndex contains '### Domain Hubs'", async () => {
		const content = await getTemplate("/foo/my-vault");
		const result = parseBrainAideFromString(content);

		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return;

		expect(result.researchIndex).toContain("### Domain Hubs");
	});

	it("researchIndex does NOT contain '## Domains' at the start of a line", async () => {
		const content = await getTemplate("/foo/my-vault");
		const result = parseBrainAideFromString(content);

		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return;

		expect(result.researchIndex).not.toMatch(/^## Domains$/m);
	});

	it("researchIndex does NOT contain '## Domain Hubs' at the start of a line", async () => {
		const content = await getTemplate("/foo/my-vault");
		const result = parseBrainAideFromString(content);

		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return;

		expect(result.researchIndex).not.toMatch(/^## Domain Hubs$/m);
	});

	it("researchIndex has no top-level '## ' heading at all", async () => {
		const content = await getTemplate("/foo/my-vault");
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
		const content = await getTemplate("/foo/my-vault");
		const result = parseBrainAideFromString(content);

		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return;

		expect(result.orientation).not.toMatch(/^## .+$/m);
	});

	it("researchIndex contains no '^## .+$' lines", async () => {
		const content = await getTemplate("/foo/my-vault");
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
		const content = await getTemplate("/foo/my-vault");
		const result = parseBrainAideFromString(content);

		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return;

		expect(result.name).toBe("obsidian");
	});

	it("mcpServerConfig.command is a non-empty string", async () => {
		const content = await getTemplate("/foo/my-vault");
		const result = parseBrainAideFromString(content);

		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return;

		expect(typeof result.mcpServerConfig.command).toBe("string");
		expect(result.mcpServerConfig.command.length).toBeGreaterThan(0);
	});

	it("mcpServerConfig.args is a non-empty string array", async () => {
		const content = await getTemplate("/foo/my-vault");
		const result = parseBrainAideFromString(content);

		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return;

		expect(Array.isArray(result.mcpServerConfig.args)).toBe(true);
		expect(result.mcpServerConfig.args.length).toBeGreaterThan(0);
		for (const arg of result.mcpServerConfig.args) {
			expect(typeof arg).toBe("string");
		}
	});

	it("result has no connector, rootPath, entryFile, or tools keys on the ok variant", async () => {
		const content = await getTemplate("/foo/my-vault");
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
// Path is inlined, no placeholder (brainPath supplied)
// ---------------------------------------------------------------------------

describe("path is inlined, no placeholder", () => {
	it("last arg equals the brainPath value byte-for-byte", async () => {
		const brainPath = "/foo/my-vault";
		const content = await getTemplate(brainPath);
		const result = parseBrainAideFromString(content);

		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return;

		const args = result.mcpServerConfig.args;
		expect(args[args.length - 1]).toBe(brainPath);
	});

	it("last arg is not the literal string ${brainPath}", async () => {
		const content = await getTemplate("/foo/my-vault");
		const result = parseBrainAideFromString(content);

		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return;

		const args = result.mcpServerConfig.args;
		expect(args[args.length - 1]).not.toBe("${brainPath}");
	});

	it("no arg element contains a ${...} placeholder", async () => {
		const content = await getTemplate("/foo/my-vault");
		const result = parseBrainAideFromString(content);

		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return;

		for (const arg of result.mcpServerConfig.args) {
			expect(arg).not.toMatch(/\$\{.+\}/);
		}
	});
});

// ---------------------------------------------------------------------------
// Optional brainPath — placeholder sentinel behaviour
// ---------------------------------------------------------------------------

describe("optional brainPath — placeholder sentinel behaviour", () => {
	it("calling with no argument parses cleanly with kind ok", async () => {
		const content = await getTemplate();
		const result = parseBrainAideFromString(content);

		expect(result.kind).toBe("ok");
	});

	it("last arg is the literal string '<BRAIN_PATH>' when brainPath is omitted", async () => {
		const content = await getTemplate();
		const result = parseBrainAideFromString(content);

		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return;

		const args = result.mcpServerConfig.args;
		expect(args[args.length - 1]).toBe("<BRAIN_PATH>");
	});

	it("on posix, args take the ['@bitbonsai/mcpvault', '<BRAIN_PATH>'] shape when brainPath is omitted", async () => {
		const content = await getTemplate(undefined, "posix");
		const result = parseBrainAideFromString(content);

		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return;

		expect(result.mcpServerConfig.args).toEqual(["@bitbonsai/mcpvault", "<BRAIN_PATH>"]);
	});

	it("on win32, args take the ['/c', 'npx', '@bitbonsai/mcpvault', '<BRAIN_PATH>'] shape when brainPath is omitted", async () => {
		const content = await getTemplate(undefined, "win32");
		const result = parseBrainAideFromString(content);

		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return;

		expect(result.mcpServerConfig.args).toEqual(["/c", "npx", "@bitbonsai/mcpvault", "<BRAIN_PATH>"]);
	});

	it("interpolateArgs is a no-op on the placeholder — '<BRAIN_PATH>' passes through unchanged", async () => {
		const content = await getTemplate();
		const result = parseBrainAideFromString(content);

		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return;

		const brainAideConfig: BrainAideConfig = { name: result.name, mcpServerConfig: result.mcpServerConfig };
		const interpolated = interpolateArgs(brainAideConfig);
		const args = result.mcpServerConfig.args;
		expect(interpolated[interpolated.length - 1]).toBe("<BRAIN_PATH>");
		expect(interpolated).toEqual(args);
	});

	it("no arg element matches the ${...} regex (placeholder is not an interpolation target)", async () => {
		const content = await getTemplate();
		const result = parseBrainAideFromString(content);

		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return;

		for (const arg of result.mcpServerConfig.args) {
			expect(arg).not.toMatch(/\$\{.+\}/);
		}
	});
});

// ---------------------------------------------------------------------------
// Platform branching — Windows
// ---------------------------------------------------------------------------

describe("platform branching — Windows", () => {
	it("command is cmd on win32", async () => {
		const content = await getTemplate("/vault", "win32");
		const result = parseBrainAideFromString(content);

		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return;

		expect(result.mcpServerConfig.command).toBe("cmd");
	});

	it("args are [/c, npx, @bitbonsai/mcpvault, brainPath] on win32", async () => {
		const brainPath = "/vault";
		const content = await getTemplate(brainPath, "win32");
		const result = parseBrainAideFromString(content);

		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return;

		expect(result.mcpServerConfig.args).toEqual(["/c", "npx", "@bitbonsai/mcpvault", brainPath]);
	});
});

// ---------------------------------------------------------------------------
// Windows path round-trip (regression for backslash YAML escape bug)
// ---------------------------------------------------------------------------

describe("Windows path round-trip (backslash regression)", () => {
	it("win32 branch: Windows path with backslashes parses cleanly and round-trips byte-for-byte", async () => {
		const brainPath = "C:\\Users\\test\\my-vault";
		const content = await getTemplate(brainPath, "win32");
		const result = parseBrainAideFromString(content);

		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return;

		const args = result.mcpServerConfig.args;
		expect(args[args.length - 1]).toBe(brainPath);
	});

	it("posix branch: Windows-formatted path string parses cleanly and round-trips byte-for-byte", async () => {
		const brainPath = "C:\\Users\\test\\my-vault";
		const content = await getTemplate(brainPath, "posix");
		const result = parseBrainAideFromString(content);

		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return;

		const args = result.mcpServerConfig.args;
		expect(args[args.length - 1]).toBe(brainPath);
	});
});

// ---------------------------------------------------------------------------
// Platform branching — POSIX
// ---------------------------------------------------------------------------

describe("platform branching — POSIX", () => {
	it("command is npx on linux", async () => {
		const content = await getTemplate("/vault", "posix");
		const result = parseBrainAideFromString(content);

		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return;

		expect(result.mcpServerConfig.command).toBe("npx");
	});

	it("args are [@bitbonsai/mcpvault, brainPath] on linux", async () => {
		const brainPath = "/vault";
		const content = await getTemplate(brainPath, "posix");
		const result = parseBrainAideFromString(content);

		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return;

		expect(result.mcpServerConfig.args).toEqual(["@bitbonsai/mcpvault", brainPath]);
	});
});

// ---------------------------------------------------------------------------
// Orientation body uses storage-agnostic vocabulary and lists all four entry-point artifacts
// ---------------------------------------------------------------------------

describe("orientation body uses storage-agnostic vocabulary and lists all four entry-point artifacts", () => {
	it("orientation is non-empty", async () => {
		const content = await getTemplate("/vault");
		const result = parseBrainAideFromString(content);

		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return;

		expect(result.orientation.trim().length).toBeGreaterThan(0);
	});

	it("orientation contains mcp__brain__read_note", async () => {
		const content = await getTemplate("/vault");
		const result = parseBrainAideFromString(content);

		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return;

		expect(result.orientation).toContain("mcp__brain__read_note");
	});

	it("orientation contains mcp__brain__search_notes", async () => {
		const content = await getTemplate("/vault");
		const result = parseBrainAideFromString(content);

		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return;

		expect(result.orientation).toContain("mcp__brain__search_notes");
	});

	it("orientation contains coding-playbook/coding-playbook.md", async () => {
		const content = await getTemplate("/vault");
		const result = parseBrainAideFromString(content);

		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return;

		expect(result.orientation).toContain("coding-playbook/coding-playbook.md");
	});

	it("orientation contains coding-playbook/study-playbook.md", async () => {
		const content = await getTemplate("/vault");
		const result = parseBrainAideFromString(content);

		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return;

		expect(result.orientation).toContain("coding-playbook/study-playbook.md");
	});

	it("orientation contains coding-playbook/update-playbook.md (new fourth entry-point artifact)", async () => {
		const content = await getTemplate("/vault");
		const result = parseBrainAideFromString(content);

		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return;

		expect(result.orientation).toContain("coding-playbook/update-playbook.md");
	});

	it("orientation contains research/research.md", async () => {
		const content = await getTemplate("/vault");
		const result = parseBrainAideFromString(content);

		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return;

		expect(result.orientation).toContain("research/research.md");
	});

	it("orientation does not contain the word 'vault'", async () => {
		const content = await getTemplate("/vault");
		const result = parseBrainAideFromString(content);

		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return;

		expect(result.orientation).not.toMatch(/\bvault\b/i);
	});

	it("orientation does not contain the word 'wikilink'", async () => {
		const content = await getTemplate("/vault");
		const result = parseBrainAideFromString(content);

		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return;

		expect(result.orientation).not.toMatch(/\bwikilinks?\b/i);
	});

	it("orientation does not contain the standalone word 'hub'", async () => {
		const content = await getTemplate("/vault");
		const result = parseBrainAideFromString(content);

		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return;

		expect(result.orientation).not.toMatch(/\bhub\b/i);
	});
});

// ---------------------------------------------------------------------------
// interpolateArgs is a no-op on the default scaffold (brainPath supplied)
// ---------------------------------------------------------------------------

describe("interpolateArgs is a no-op on the default scaffold", () => {
	it("interpolated args are deep-equal to original args (no placeholders to replace)", async () => {
		const brainPath = "/home/user/vault";
		const content = await getTemplate(brainPath);
		const result = parseBrainAideFromString(content);

		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return;

		const brainAideConfig: BrainAideConfig = { name: result.name, mcpServerConfig: result.mcpServerConfig };
		const interpolated = interpolateArgs(brainAideConfig);
		expect(interpolated).toEqual(result.mcpServerConfig.args);
	});

	it("interpolateArgs does not mutate the parsed config args", async () => {
		const content = await getTemplate("/vault");
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
		const content = await getTemplate("/vault");

		expect(content.split("\n---\n").length).toBeGreaterThanOrEqual(2);
	});

	it("frontmatter block contains name and mcpServerConfig", async () => {
		const content = await getTemplate("/vault");
		const frontmatterBlock = content.split("\n---\n")[0];

		expect(frontmatterBlock).toMatch(/^name:/m);
		expect(frontmatterBlock).toMatch(/^mcpServerConfig:/m);
	});

	it("frontmatter block does not contain intent-spec fields", async () => {
		const content = await getTemplate("/vault");
		const frontmatterBlock = content.split("\n---\n")[0];

		expect(frontmatterBlock).not.toMatch(/^scope:/m);
		expect(frontmatterBlock).not.toMatch(/^outcomes:/m);
		expect(frontmatterBlock).not.toMatch(/^intent:/m);
		expect(frontmatterBlock).not.toMatch(/^status:/m);
	});

	it("frontmatter block does not contain deprecated schema fields", async () => {
		const content = await getTemplate("/vault");
		const frontmatterBlock = content.split("\n---\n")[0];

		expect(frontmatterBlock).not.toMatch(/^connector:/m);
		expect(frontmatterBlock).not.toMatch(/^rootPath:/m);
		expect(frontmatterBlock).not.toMatch(/^entryFile:/m);
		expect(frontmatterBlock).not.toMatch(/^tools:/m);
	});
});
