import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import parseBrainAide, { parseBrainAideFromString, interpolateArgs } from "@/service/parseBrainAide/index.js";

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

async function getTemplate(rootPath: string, mockedPlatform?: "win32" | "posix"): Promise<string> {
	const { platform } = await import("node:os");
	if (mockedPlatform !== undefined) {
		vi.mocked(platform).mockReturnValue(mockedPlatform === "win32" ? "win32" : "linux");
	}
	const { default: obsidianBrainAideTemplate } = await import("./index.js");
	return obsidianBrainAideTemplate(rootPath);
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
		const rootPath = "/foo/my-vault";
		const content = await getTemplate(rootPath);

		await writeBrainAide(tempDir, content);
		const result = await parseBrainAide(tempDir);

		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return;

		expect(result.config.name).toBe("obsidian");
		expect(result.playbookHub.length).toBeGreaterThan(0);
		expect(result.researchHub.length).toBeGreaterThan(0);
	});

	it("parseBrainAideFromString produces the same ok result as writing to disk", async () => {
		const rootPath = "/foo/my-vault";
		const content = await getTemplate(rootPath);

		await writeBrainAide(tempDir, content);
		const fromDisk = await parseBrainAide(tempDir);
		const fromString = parseBrainAideFromString(content);

		expect(fromDisk.kind).toBe("ok");
		expect(fromString.kind).toBe("ok");
		expect(fromDisk).toEqual(fromString);
	});
});

// ---------------------------------------------------------------------------
// Three-section body shape
// ---------------------------------------------------------------------------

describe("three-section body shape", () => {
	it("result.kind is ok — parser accepts the three-section body grammar", async () => {
		const content = await getTemplate("/foo/my-vault");
		const result = parseBrainAideFromString(content);

		expect(result.kind).toBe("ok");
	});

	it("prose is a non-empty string", async () => {
		const content = await getTemplate("/foo/my-vault");
		const result = parseBrainAideFromString(content);

		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return;

		expect(typeof result.prose).toBe("string");
		expect(result.prose.length).toBeGreaterThan(0);
	});

	it("playbookHub is a non-empty string", async () => {
		const content = await getTemplate("/foo/my-vault");
		const result = parseBrainAideFromString(content);

		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return;

		expect(typeof result.playbookHub).toBe("string");
		expect(result.playbookHub.length).toBeGreaterThan(0);
	});

	it("researchHub is a non-empty string", async () => {
		const content = await getTemplate("/foo/my-vault");
		const result = parseBrainAideFromString(content);

		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return;

		expect(typeof result.researchHub).toBe("string");
		expect(result.researchHub.length).toBeGreaterThan(0);
	});

	it("prose, playbookHub, and researchHub are byte-distinct from each other", async () => {
		const content = await getTemplate("/foo/my-vault");
		const result = parseBrainAideFromString(content);

		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return;

		expect(result.prose).not.toBe(result.playbookHub);
		expect(result.prose).not.toBe(result.researchHub);
		expect(result.playbookHub).not.toBe(result.researchHub);
	});
});

// ---------------------------------------------------------------------------
// Playbook hub section preserves sentinel structure
// ---------------------------------------------------------------------------

describe("Playbook hub section preserves sentinel structure", () => {
	it("playbookHub contains the H1 title '# Coding Playbook'", async () => {
		const content = await getTemplate("/foo/my-vault");
		const result = parseBrainAideFromString(content);

		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return;

		expect(result.playbookHub).toContain("# Coding Playbook");
	});

	it("playbookHub contains '### Task Routing' (nested heading demoted to H3)", async () => {
		const content = await getTemplate("/foo/my-vault");
		const result = parseBrainAideFromString(content);

		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return;

		expect(result.playbookHub).toContain("### Task Routing");
	});

	it("playbookHub does NOT contain '## Task Routing' at the start of a line", async () => {
		const content = await getTemplate("/foo/my-vault");
		const result = parseBrainAideFromString(content);

		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return;

		expect(result.playbookHub).not.toMatch(/^## Task Routing$/m);
	});

	it("playbookHub contains '[[your-conventions-note]]'", async () => {
		const content = await getTemplate("/foo/my-vault");
		const result = parseBrainAideFromString(content);

		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return;

		expect(result.playbookHub).toContain("[[your-conventions-note]]");
	});

	it("playbookHub contains '[[your-folder-structure-note]]'", async () => {
		const content = await getTemplate("/foo/my-vault");
		const result = parseBrainAideFromString(content);

		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return;

		expect(result.playbookHub).toContain("[[your-folder-structure-note]]");
	});
});

// ---------------------------------------------------------------------------
// Research hub section ships structural seed
// ---------------------------------------------------------------------------

describe("Research hub section ships structural seed", () => {
	it("researchHub contains the H1 title '# Research'", async () => {
		const content = await getTemplate("/foo/my-vault");
		const result = parseBrainAideFromString(content);

		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return;

		expect(result.researchHub).toContain("# Research");
	});

	it("researchHub contains '### Domains' (nested heading at H3)", async () => {
		const content = await getTemplate("/foo/my-vault");
		const result = parseBrainAideFromString(content);

		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return;

		expect(result.researchHub).toContain("### Domains");
	});

	it("researchHub contains '### Domain Hubs'", async () => {
		const content = await getTemplate("/foo/my-vault");
		const result = parseBrainAideFromString(content);

		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return;

		expect(result.researchHub).toContain("### Domain Hubs");
	});

	it("researchHub does NOT contain '## Domains' at the start of a line", async () => {
		const content = await getTemplate("/foo/my-vault");
		const result = parseBrainAideFromString(content);

		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return;

		expect(result.researchHub).not.toMatch(/^## Domains$/m);
	});

	it("researchHub does NOT contain '## Domain Hubs' at the start of a line", async () => {
		const content = await getTemplate("/foo/my-vault");
		const result = parseBrainAideFromString(content);

		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return;

		expect(result.researchHub).not.toMatch(/^## Domain Hubs$/m);
	});

	it("researchHub has no top-level '## ' heading at all", async () => {
		const content = await getTemplate("/foo/my-vault");
		const result = parseBrainAideFromString(content);

		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return;

		expect(result.researchHub).not.toMatch(/^## .+$/m);
	});
});

// ---------------------------------------------------------------------------
// No nested '## ' headings inside any body section (closed-vocabulary regression)
// ---------------------------------------------------------------------------

describe("no nested '## ' headings inside any body section", () => {
	it("prose contains no '^## .+$' lines", async () => {
		const content = await getTemplate("/foo/my-vault");
		const result = parseBrainAideFromString(content);

		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return;

		expect(result.prose).not.toMatch(/^## .+$/m);
	});

	it("playbookHub contains no '^## .+$' lines", async () => {
		const content = await getTemplate("/foo/my-vault");
		const result = parseBrainAideFromString(content);

		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return;

		expect(result.playbookHub).not.toMatch(/^## .+$/m);
	});

	it("researchHub contains no '^## .+$' lines", async () => {
		const content = await getTemplate("/foo/my-vault");
		const result = parseBrainAideFromString(content);

		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return;

		expect(result.researchHub).not.toMatch(/^## .+$/m);
	});
});

// ---------------------------------------------------------------------------
// Parsed config contains EXACTLY the new fields
// ---------------------------------------------------------------------------

describe("parsed config contains exactly the new fields", () => {
	it("name is obsidian", async () => {
		const content = await getTemplate("/foo/my-vault");
		const result = parseBrainAideFromString(content);

		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return;

		expect(result.config.name).toBe("obsidian");
	});

	it("mcpServerConfig.command is a non-empty string", async () => {
		const content = await getTemplate("/foo/my-vault");
		const result = parseBrainAideFromString(content);

		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return;

		expect(typeof result.config.mcpServerConfig.command).toBe("string");
		expect(result.config.mcpServerConfig.command.length).toBeGreaterThan(0);
	});

	it("mcpServerConfig.args is a non-empty string array", async () => {
		const content = await getTemplate("/foo/my-vault");
		const result = parseBrainAideFromString(content);

		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return;

		expect(Array.isArray(result.config.mcpServerConfig.args)).toBe(true);
		expect(result.config.mcpServerConfig.args.length).toBeGreaterThan(0);
		for (const arg of result.config.mcpServerConfig.args) {
			expect(typeof arg).toBe("string");
		}
	});

	it("config has no connector, rootPath, entryFile, or tools keys", async () => {
		const content = await getTemplate("/foo/my-vault");
		const result = parseBrainAideFromString(content);

		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return;

		expect(Object.prototype.hasOwnProperty.call(result.config, "connector")).toBe(false);
		expect(Object.prototype.hasOwnProperty.call(result.config, "rootPath")).toBe(false);
		expect(Object.prototype.hasOwnProperty.call(result.config, "entryFile")).toBe(false);
		expect(Object.prototype.hasOwnProperty.call(result.config, "tools")).toBe(false);
	});
});

// ---------------------------------------------------------------------------
// Path is inlined, no placeholder
// ---------------------------------------------------------------------------

describe("path is inlined, no placeholder", () => {
	it("last arg equals the rootPath value byte-for-byte", async () => {
		const rootPath = "/foo/my-vault";
		const content = await getTemplate(rootPath);
		const result = parseBrainAideFromString(content);

		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return;

		const args = result.config.mcpServerConfig.args;
		expect(args[args.length - 1]).toBe(rootPath);
	});

	it("last arg is not the literal string ${rootPath}", async () => {
		const content = await getTemplate("/foo/my-vault");
		const result = parseBrainAideFromString(content);

		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return;

		const args = result.config.mcpServerConfig.args;
		expect(args[args.length - 1]).not.toBe("${rootPath}");
	});

	it("no arg element contains a ${...} placeholder", async () => {
		const content = await getTemplate("/foo/my-vault");
		const result = parseBrainAideFromString(content);

		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return;

		for (const arg of result.config.mcpServerConfig.args) {
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

		expect(result.config.mcpServerConfig.command).toBe("cmd");
	});

	it("args are [/c, npx, @bitbonsai/mcpvault, rootPath] on win32", async () => {
		const rootPath = "/vault";
		const content = await getTemplate(rootPath, "win32");
		const result = parseBrainAideFromString(content);

		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return;

		expect(result.config.mcpServerConfig.args).toEqual(["/c", "npx", "@bitbonsai/mcpvault", rootPath]);
	});
});

// ---------------------------------------------------------------------------
// Windows path round-trip (regression for backslash YAML escape bug)
// ---------------------------------------------------------------------------

describe("Windows path round-trip (backslash regression)", () => {
	it("win32 branch: Windows path with backslashes parses cleanly and round-trips byte-for-byte", async () => {
		const rootPath = "C:\\Users\\test\\my-vault";
		const content = await getTemplate(rootPath, "win32");
		const result = parseBrainAideFromString(content);

		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return;

		const args = result.config.mcpServerConfig.args;
		expect(args[args.length - 1]).toBe(rootPath);
	});

	it("posix branch: Windows-formatted path string parses cleanly and round-trips byte-for-byte", async () => {
		const rootPath = "C:\\Users\\test\\my-vault";
		const content = await getTemplate(rootPath, "posix");
		const result = parseBrainAideFromString(content);

		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return;

		const args = result.config.mcpServerConfig.args;
		expect(args[args.length - 1]).toBe(rootPath);
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

		expect(result.config.mcpServerConfig.command).toBe("npx");
	});

	it("args are [@bitbonsai/mcpvault, rootPath] on linux", async () => {
		const rootPath = "/vault";
		const content = await getTemplate(rootPath, "posix");
		const result = parseBrainAideFromString(content);

		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return;

		expect(result.config.mcpServerConfig.args).toEqual(["@bitbonsai/mcpvault", rootPath]);
	});
});

// ---------------------------------------------------------------------------
// Prose body sentinel phrases preserved
// ---------------------------------------------------------------------------

describe("prose body sentinel phrases preserved", () => {
	it("prose is non-empty", async () => {
		const content = await getTemplate("/vault");
		const result = parseBrainAideFromString(content);

		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return;

		expect(result.prose.trim().length).toBeGreaterThan(0);
	});

	it("prose contains mcp__brain__read_note", async () => {
		const content = await getTemplate("/vault");
		const result = parseBrainAideFromString(content);

		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return;

		expect(result.prose).toContain("mcp__brain__read_note");
	});

	it("prose contains mcp__brain__search_notes", async () => {
		const content = await getTemplate("/vault");
		const result = parseBrainAideFromString(content);

		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return;

		expect(result.prose).toContain("mcp__brain__search_notes");
	});

	it("prose contains coding-playbook/coding-playbook.md (new entry hub pointer)", async () => {
		const content = await getTemplate("/vault");
		const result = parseBrainAideFromString(content);

		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return;

		expect(result.prose).toContain("coding-playbook/coding-playbook.md");
	});

	it("prose contains research/research.md (new entry hub pointer)", async () => {
		const content = await getTemplate("/vault");
		const result = parseBrainAideFromString(content);

		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return;

		expect(result.prose).toContain("research/research.md");
	});

	it("prose contains wikilink", async () => {
		const content = await getTemplate("/vault");
		const result = parseBrainAideFromString(content);

		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return;

		expect(result.prose).toContain("wikilink");
	});
});

// ---------------------------------------------------------------------------
// interpolateArgs is a no-op on the default scaffold
// ---------------------------------------------------------------------------

describe("interpolateArgs is a no-op on the default scaffold", () => {
	it("interpolated args are deep-equal to original args (no placeholders to replace)", async () => {
		const rootPath = "/home/user/vault";
		const content = await getTemplate(rootPath);
		const result = parseBrainAideFromString(content);

		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return;

		const interpolated = interpolateArgs(result.config);
		expect(interpolated).toEqual(result.config.mcpServerConfig.args);
	});

	it("interpolateArgs does not mutate the parsed config args", async () => {
		const content = await getTemplate("/vault");
		const result = parseBrainAideFromString(content);

		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return;

		const originalArgs = [...result.config.mcpServerConfig.args];
		interpolateArgs(result.config);
		expect(result.config.mcpServerConfig.args).toEqual(originalArgs);
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
