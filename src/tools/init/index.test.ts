import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, mkdir, writeFile, readFile, readdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import init from "./index.js";

let tempDir: string;

beforeEach(async () => {
	tempDir = await mkdtemp(join(tmpdir(), "aide-init-"));
});

afterEach(async () => {
	await rm(tempDir, { recursive: true, force: true });
});

describe("init", () => {
	it("creates all files for a fresh project", async () => {
		const result = await init(tempDir);

		expect(result).toContain("AIDE initialized");
		expect(result).toContain("claude framework");

		// Methodology written
		const config = await readFile(join(tempDir, "CLAUDE.md"), "utf-8");
		expect(config).toContain("<!-- aide-methodology -->");
		expect(config).toContain("AIDE");

		// Commands created
		const commands = await readdir(join(tempDir, ".claude", "commands"));
		expect(commands).toContain("aide-research.md");
		expect(commands).toContain("aide-spec.md");
		expect(commands).toContain("aide-build.md");
		expect(commands).toContain("aide-qa.md");
		expect(commands).toContain("aide-fix.md");

		// MCP config wired
		const mcp = JSON.parse(await readFile(join(tempDir, ".mcp.json"), "utf-8"));
		expect(mcp.mcpServers.aide).toEqual({ command: "npx", args: ["aidemd-mcp"] });
	});

	it("is idempotent — reports existing when run twice", async () => {
		await init(tempDir);
		const result = await init(tempDir);

		expect(result).toContain("AIDE already initialized");
	});

	it("appends methodology to existing config without overwriting", async () => {
		const existing = "# My Project\n\nExisting content here.\n";
		await writeFile(join(tempDir, "CLAUDE.md"), existing, "utf-8");

		await init(tempDir);

		const config = await readFile(join(tempDir, "CLAUDE.md"), "utf-8");
		expect(config).toContain("Existing content here.");
		expect(config).toContain("<!-- aide-methodology -->");
	});

	it("adds to existing MCP config without overwriting", async () => {
		const existing = {
			mcpServers: {
				other: { command: "node", args: ["other.js"] },
			},
		};
		await writeFile(join(tempDir, ".mcp.json"), JSON.stringify(existing), "utf-8");

		await init(tempDir);

		const mcp = JSON.parse(await readFile(join(tempDir, ".mcp.json"), "utf-8"));
		expect(mcp.mcpServers.other).toEqual({ command: "node", args: ["other.js"] });
		expect(mcp.mcpServers.aide).toEqual({ command: "npx", args: ["aidemd-mcp"] });
	});

	it("skips MCP wiring when aide entry already exists", async () => {
		const existing = {
			mcpServers: {
				aide: { command: "npx", args: ["aidemd-mcp"] },
			},
		};
		await writeFile(join(tempDir, ".mcp.json"), JSON.stringify(existing), "utf-8");

		const result = await init(tempDir);

		expect(result).toContain("MCP config: Already exists");
	});

	it("respects framework override", async () => {
		const result = await init(tempDir, "cursor");

		expect(result).toContain("cursor framework");

		const config = await readFile(join(tempDir, ".cursorrules"), "utf-8");
		expect(config).toContain("<!-- aide-methodology -->");

		const commands = await readdir(join(tempDir, ".cursor", "commands"));
		expect(commands).toContain("aide-research.md");
	});

	it("respects path override", async () => {
		const subDir = join(tempDir, "subproject");
		await mkdir(subDir);

		const result = await init(tempDir, undefined, "subproject");

		expect(result).toContain("AIDE initialized");
		const config = await readFile(join(subDir, "CLAUDE.md"), "utf-8");
		expect(config).toContain("<!-- aide-methodology -->");
	});

	it("detects framework from existing project files", async () => {
		await mkdir(join(tempDir, ".cursor"));

		const result = await init(tempDir);

		expect(result).toContain("cursor framework");
	});

	it("skips MCP wiring when config contains invalid JSON", async () => {
		await writeFile(join(tempDir, ".mcp.json"), "not valid json {{{", "utf-8");

		const result = await init(tempDir);

		expect(result).toContain("MCP config: Skipped");
	});
});
