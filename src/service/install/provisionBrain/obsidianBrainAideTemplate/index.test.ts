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
	await mkdir(join(root, ".aide"), { recursive: true });
	await writeFile(join(root, ".aide", "brain.aide"), content, "utf-8");
}

// ---------------------------------------------------------------------------
// 2a. Output is parseable by parseBrainAide — round-trip invariant
// ---------------------------------------------------------------------------

describe("2a — output is parseable by parseBrainAide", () => {
	it("template output round-trips through parseBrainAide with kind ok and matching config", async () => {
		const rootPath = "/foo/my-vault";
		const content = await getTemplate(rootPath);

		await writeBrainAide(tempDir, content);
		const result = await parseBrainAide(tempDir);

		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return;

		expect(result.config.connector).toBe("obsidian");
		expect(result.config.rootPath).toBe(rootPath);
		expect(result.config.entryFile).toBe("CLAUDE.md");
		expect(result.config.tools.read).toBe("mcp__brain__read_note");
		expect(result.config.tools.search).toBe("mcp__brain__search_notes");
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
// 2b. rootPath interpolated into YAML field but NOT into args
// ---------------------------------------------------------------------------

describe("2b — rootPath is interpolated into the YAML field but not into args", () => {
	it("parsed config.rootPath equals the passed rootPath value", async () => {
		const rootPath = "/foo";
		const content = await getTemplate(rootPath);
		const result = parseBrainAideFromString(content);

		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return;

		expect(result.config.rootPath).toBe("/foo");
	});

	it("parsed config.mcpServerConfig.args still contains the literal ${rootPath} placeholder", async () => {
		const rootPath = "/foo";
		const content = await getTemplate(rootPath);
		const result = parseBrainAideFromString(content);

		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return;

		expect(result.config.mcpServerConfig.args).toContain("${rootPath}");
	});

	it("${rootPath} does not appear as the rootPath value — the YAML field is resolved, the args placeholder is not", async () => {
		const rootPath = "/foo";
		const content = await getTemplate(rootPath);
		const result = parseBrainAideFromString(content);

		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return;

		// rootPath field holds the resolved value
		expect(result.config.rootPath).toBe("/foo");
		// args hold the literal placeholder, not the resolved value
		const lastArg = result.config.mcpServerConfig.args[result.config.mcpServerConfig.args.length - 1];
		expect(lastArg).toBe("${rootPath}");
		expect(lastArg).not.toBe("/foo");
	});
});

// ---------------------------------------------------------------------------
// 2c. Platform branching — Windows vs POSIX
// ---------------------------------------------------------------------------

describe("2c — platform branching", () => {
	it("win32: command is cmd and first two args are /c and npx", async () => {
		const content = await getTemplate("/vault", "win32");
		const result = parseBrainAideFromString(content);

		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return;

		expect(result.config.mcpServerConfig.command).toBe("cmd");
		expect(result.config.mcpServerConfig.args[0]).toBe("/c");
		expect(result.config.mcpServerConfig.args[1]).toBe("npx");
	});

	it("posix (linux): command is npx and args does not start with /c", async () => {
		const content = await getTemplate("/vault", "posix");
		const result = parseBrainAideFromString(content);

		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return;

		expect(result.config.mcpServerConfig.command).toBe("npx");
		expect(result.config.mcpServerConfig.args[0]).not.toBe("/c");
	});

	it("win32: args shape is exactly [\"/c\", \"npx\", \"-y\", \"obsidian-mcp\", \"${rootPath}\"]", async () => {
		const content = await getTemplate("/vault", "win32");
		const result = parseBrainAideFromString(content);

		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return;

		expect(result.config.mcpServerConfig.args).toEqual(["/c", "npx", "-y", "obsidian-mcp", "${rootPath}"]);
	});

	it("posix: args shape is exactly [\"-y\", \"obsidian-mcp\", \"${rootPath}\"]", async () => {
		const content = await getTemplate("/vault", "posix");
		const result = parseBrainAideFromString(content);

		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return;

		expect(result.config.mcpServerConfig.args).toEqual(["-y", "obsidian-mcp", "${rootPath}"]);
	});
});

// ---------------------------------------------------------------------------
// 2d. Parsed prose body is non-empty and contains expected sentinel phrases
// ---------------------------------------------------------------------------

describe("2d — parsed prose body is non-empty and contains sentinel phrases", () => {
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

	it("prose contains CLAUDE.md", async () => {
		const content = await getTemplate("/vault");
		const result = parseBrainAideFromString(content);

		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return;

		expect(result.prose).toContain("CLAUDE.md");
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
// 2e. interpolateArgs round-trip
// ---------------------------------------------------------------------------

describe("2e — interpolateArgs round-trip", () => {
	it("interpolateArgs replaces ${rootPath} placeholder with the literal rootPath value", async () => {
		const rootPath = "/home/user/vault";
		const content = await getTemplate(rootPath);
		const result = parseBrainAideFromString(content);

		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return;

		const interpolated = interpolateArgs(result.config);

		expect(interpolated).toContain(rootPath);
		expect(interpolated).not.toContain("${rootPath}");
	});

	it("win32: interpolated args replace placeholder with actual vault path in correct position", async () => {
		const rootPath = "D:/notes/my-vault";
		const content = await getTemplate(rootPath, "win32");
		const result = parseBrainAideFromString(content);

		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return;

		const interpolated = interpolateArgs(result.config);

		expect(interpolated).toEqual(["/c", "npx", "-y", "obsidian-mcp", rootPath]);
	});

	it("posix: interpolated args replace placeholder with actual vault path in correct position", async () => {
		const rootPath = "/home/user/vault";
		const content = await getTemplate(rootPath, "posix");
		const result = parseBrainAideFromString(content);

		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return;

		const interpolated = interpolateArgs(result.config);

		expect(interpolated).toEqual(["-y", "obsidian-mcp", rootPath]);
	});

	it("interpolateArgs does not mutate the parsed config args", async () => {
		const rootPath = "/vault";
		const content = await getTemplate(rootPath);
		const result = parseBrainAideFromString(content);

		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return;

		const originalArgs = [...result.config.mcpServerConfig.args];
		interpolateArgs(result.config);

		expect(result.config.mcpServerConfig.args).toEqual(originalArgs);
	});
});

// ---------------------------------------------------------------------------
// Additional: schema does NOT include intent-spec fields
// ---------------------------------------------------------------------------

describe("schema does not include intent-spec frontmatter fields", () => {
	it("parsed frontmatter has no scope, outcomes, intent, or status field", async () => {
		const content = await getTemplate("/vault");

		// Parse the YAML frontmatter directly to confirm absence of intent-spec fields.
		// We do this by checking that the raw content string does not contain these keys
		// at the YAML level (not in prose), and that parseBrainAideFromString succeeds
		// without them — the parser does not look for or surface these fields.
		const result = parseBrainAideFromString(content);

		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return;

		// The config type has no scope, outcomes, intent, or status field.
		// TypeScript enforces this at compile time; at runtime we verify the
		// raw string does not contain these keys in the frontmatter block.
		const frontmatterBlock = content.split("\n---\n")[0];
		expect(frontmatterBlock).not.toMatch(/^scope:/m);
		expect(frontmatterBlock).not.toMatch(/^outcomes:/m);
		expect(frontmatterBlock).not.toMatch(/^intent:/m);
		expect(frontmatterBlock).not.toMatch(/^status:/m);
	});
});
