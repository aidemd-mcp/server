import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, mkdir, readFile, readdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir, platform } from "node:os";
import init from "./index.js";

const expectedMcpEntry = platform() === "win32"
	? { command: "cmd", args: ["/c", "npx", "aidemd-mcp"] }
	: { command: "npx", args: ["aidemd-mcp"] };

let tempDir: string;

beforeEach(async () => {
	tempDir = await mkdtemp(join(tmpdir(), "aide-init-"));
});

afterEach(async () => {
	await rm(tempDir, { recursive: true, force: true });
});

describe("init", () => {
	it("sequences all helpers and reports their results for a fresh project", async () => {
		const result = await init(tempDir);

		expect(result).toContain("AIDE initialized");
		expect(result).toContain("claude framework");
		expect(result).toContain("Methodology pointer");
		expect(result).toContain(".aide/docs/aide-spec.md");
		expect(result).toContain(".aide/docs/index.md");
		expect(result).toContain("Doc hub: .aide/docs");
		expect(result).toContain("MCP config");

		// Pointer stub written into the config file (not the full body)
		const config = await readFile(join(tempDir, "CLAUDE.md"), "utf-8");
		expect(config).toContain("<!-- aide-methodology -->");
		expect(config).toContain(".aide/docs");

		// Doc hub landed on disk
		const hubFiles = await readdir(join(tempDir, ".aide", "docs"));
		expect(hubFiles).toContain("aide-spec.md");
		expect(hubFiles).toContain("aide-template.md");
		expect(hubFiles).toContain("progressive-disclosure.md");
		expect(hubFiles).toContain("agent-readable-code.md");
		expect(hubFiles).toContain("automated-qa.md");
		expect(hubFiles).toContain("index.md");

		// Commands scaffolded under the aide/ namespace subfolder
		const commands = await readdir(join(tempDir, ".claude", "commands", "aide"));
		expect(commands).toContain("research.md");

		// MCP config wired
		const mcp = JSON.parse(await readFile(join(tempDir, ".mcp.json"), "utf-8"));
		expect(mcp.mcpServers.aide).toEqual(expectedMcpEntry);
	});

	it("is idempotent — reports already initialized when run twice", async () => {
		await init(tempDir);
		const result = await init(tempDir);

		expect(result).toContain("AIDE already initialized");
	});

	it("respects framework override", async () => {
		const result = await init(tempDir, "cursor");

		expect(result).toContain("cursor framework");

		const config = await readFile(join(tempDir, ".cursorrules"), "utf-8");
		expect(config).toContain("<!-- aide-methodology -->");

		const commands = await readdir(join(tempDir, ".cursor", "commands", "aide"));
		expect(commands).toContain("research.md");
	});

	it("respects path override", async () => {
		const subDir = join(tempDir, "subproject");
		await mkdir(subDir);

		const result = await init(tempDir, undefined, "subproject");

		expect(result).toContain("AIDE initialized");
		const config = await readFile(join(subDir, "CLAUDE.md"), "utf-8");
		expect(config).toContain("<!-- aide-methodology -->");
	});

	it("uses detectFramework to pick up framework from on-disk files", async () => {
		await mkdir(join(tempDir, ".cursor"));

		const result = await init(tempDir);

		expect(result).toContain("cursor framework");
	});
});
