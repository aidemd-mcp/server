import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, mkdir, readFile, readdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir, platform } from "node:os";
import init from "./index.js";

// Clean up AIDE_BRAIN_PATH after each test to avoid cross-test pollution
const originalBrainPath = process.env.AIDE_BRAIN_PATH;

const expectedMcpEntry = platform() === "win32"
	? { command: "cmd", args: ["/c", "npx", "aidemd-mcp"] }
	: { command: "npx", args: ["aidemd-mcp"] };

let tempDir: string;

beforeEach(async () => {
	tempDir = await mkdtemp(join(tmpdir(), "aide-init-"));
});

afterEach(async () => {
	await rm(tempDir, { recursive: true, force: true });
	// Restore AIDE_BRAIN_PATH to avoid cross-test pollution
	if (originalBrainPath === undefined) {
		delete process.env.AIDE_BRAIN_PATH;
	} else {
		process.env.AIDE_BRAIN_PATH = originalBrainPath;
	}
});

describe("init", () => {
	it("sequences all helpers and reports their results for a fresh project", async () => {
		const brainPath = join(tempDir, "test-brain");
		process.env.AIDE_BRAIN_PATH = brainPath;

		const result = await init(tempDir);

		expect(result).toContain("AIDE initialized");
		expect(result).toContain("claude framework");
		expect(result).toContain("Methodology pointer");
		expect(result).toContain(".aide/docs/aide-spec.md");
		expect(result).toContain(".aide/docs/index.md");
		expect(result).toContain("Doc hub: .aide/docs");
		expect(result).toContain("MCP config");
		expect(result).toContain("Brain vault");

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

		// Brain vault was actually provisioned on disk — not just mentioned in output
		const vaultEntries = await readdir(brainPath);
		expect(vaultEntries).toContain("research");
		expect(vaultEntries).toContain("coding-playbook");
		expect(vaultEntries).toContain("process");

		// Obsidian MCP is configured — either wired into the project config or
		// already present in the user-level config (e.g. ~/.claude.json). The
		// output must mention it and the result must not be "skipped".
		expect(result).toContain("MCP config (obsidian)");
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

	it("creates vault at AIDE_BRAIN_PATH when env var is set", async () => {
		const brainPath = join(tempDir, "env-brain");
		process.env.AIDE_BRAIN_PATH = brainPath;

		const result = await init(tempDir);

		expect(result).toContain("Brain vault");
		expect(result).toContain(`Brain: ${brainPath}`);

		const entries = await readdir(brainPath);
		expect(entries).toContain("research");
		expect(entries).toContain("coding-playbook");
	});

	it("explicit brainPath parameter takes priority over AIDE_BRAIN_PATH env var", async () => {
		const envBrainPath = join(tempDir, "env-brain");
		const explicitBrainPath = join(tempDir, "explicit-brain");
		process.env.AIDE_BRAIN_PATH = envBrainPath;

		const result = await init(tempDir, undefined, undefined, undefined, explicitBrainPath);

		expect(result).toContain(`Brain: ${explicitBrainPath}`);
		// Explicit path got the vault, not the env path
		const entries = await readdir(explicitBrainPath);
		expect(entries).toContain("research");
	});
});
