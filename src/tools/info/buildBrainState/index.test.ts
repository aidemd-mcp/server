import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/service/install/detectFramework/index.js");
vi.mock("@/service/install/resolveBrainHints/index.js");
vi.mock("node:fs/promises");

import detectFramework from "@/service/install/detectFramework/index.js";
import resolveBrainHints from "@/service/install/resolveBrainHints/index.js";
import { readFile, stat } from "node:fs/promises";
import buildBrainState from "./index.js";

const mockDetectFramework = detectFramework as ReturnType<typeof vi.fn>;
const mockResolveBrainHints = resolveBrainHints as ReturnType<typeof vi.fn>;
const mockReadFile = readFile as ReturnType<typeof vi.fn>;
const mockStat = stat as ReturnType<typeof vi.fn>;

// Factory functions — build MCP config JSON fixtures.

function makeMcpConfigWithObsidian(vaultPath: string): string {
	return JSON.stringify({
		mcpServers: {
			obsidian: {
				command: "npx",
				args: ["@bitbonsai/mcpvault", vaultPath],
			},
		},
	});
}

function makeMcpConfigWithoutObsidian(): string {
	return JSON.stringify({
		mcpServers: {
			"aidemd-mcp": {
				command: "npx",
				args: ["aidemd-mcp"],
			},
		},
	});
}

const MALFORMED_JSON = "{ not valid json ]";

// Fixed framework config — the helper is framework-agnostic; one framework is sufficient.
const FIXED_FRAMEWORK_CONFIG = {
	framework: "claude" as const,
	configPath: "CLAUDE.md",
	commandDir: ".claude/commands",
	mcpConfigPath: ".mcp.json",
	docHubDir: ".aide/docs",
	agentDir: ".claude/agents",
	skillDir: ".claude/skills",
};

// A fake Stats object whose isDirectory() returns true.
function makeStatDir(): { isDirectory: () => boolean } {
	return { isDirectory: () => true };
}

// A fake Stats object whose isDirectory() returns false (e.g. a file).
function makeStatFile(): { isDirectory: () => boolean } {
	return { isDirectory: () => false };
}

describe("buildBrainState", () => {
	beforeEach(() => {
		vi.resetAllMocks();
		mockDetectFramework.mockResolvedValue(FIXED_FRAMEWORK_CONFIG);
		// Default: no candidates found — deterministic baseline for all tests.
		mockResolveBrainHints.mockResolvedValue([]);
	});

	it("returns no-mcp-entry when readFile rejects with ENOENT", async () => {
		const enoent = Object.assign(new Error("ENOENT: no such file or directory"), { code: "ENOENT" });
		mockReadFile.mockRejectedValue(enoent);

		const result = await buildBrainState("/project/root");

		expect(result).toEqual({ status: "no-mcp-entry", vaultPath: null, hints: [] });
	});

	it("returns no-mcp-entry when readFile returns malformed JSON", async () => {
		mockReadFile.mockResolvedValue(MALFORMED_JSON);

		const result = await buildBrainState("/project/root");

		expect(result).toEqual({ status: "no-mcp-entry", vaultPath: null, hints: [] });
	});

	it("returns no-mcp-entry when mcpServers is present but has no obsidian key", async () => {
		mockReadFile.mockResolvedValue(makeMcpConfigWithoutObsidian());

		const result = await buildBrainState("/project/root");

		expect(result).toEqual({ status: "no-mcp-entry", vaultPath: null, hints: [] });
	});

	it("returns no-mcp-entry when obsidian entry has an empty args array", async () => {
		mockReadFile.mockResolvedValue(
			JSON.stringify({
				mcpServers: {
					obsidian: { command: "npx", args: [] },
				},
			}),
		);

		const result = await buildBrainState("/project/root");

		expect(result).toEqual({ status: "no-mcp-entry", vaultPath: null, hints: [] });
	});

	it("returns invalid-path with empty vaultPath when obsidian entry has an empty-string last arg (cold-install state)", async () => {
		// The CLI writes an obsidian entry with an empty vault path on cold install
		// so the orchestrator's inline-recovery flow can prompt the user for the path.
		// This must surface as invalid-path (not no-mcp-entry) so the orchestrator
		// fires the AskUserQuestion branch rather than telling the user to re-run init.
		mockReadFile.mockResolvedValue(makeMcpConfigWithObsidian(""));

		const result = await buildBrainState("/project/root");

		expect(result).toEqual({ status: "invalid-path", vaultPath: "", hints: [] });
	});

	it("returns no-mcp-entry when obsidian entry has no args field", async () => {
		mockReadFile.mockResolvedValue(
			JSON.stringify({
				mcpServers: {
					obsidian: { command: "npx" },
				},
			}),
		);

		const result = await buildBrainState("/project/root");

		expect(result).toEqual({ status: "no-mcp-entry", vaultPath: null, hints: [] });
	});

	it("returns no-mcp-entry when obsidian entry has args that is not an array", async () => {
		mockReadFile.mockResolvedValue(
			JSON.stringify({
				mcpServers: {
					obsidian: { command: "npx", args: "/home/vault" },
				},
			}),
		);

		const result = await buildBrainState("/project/root");

		expect(result).toEqual({ status: "no-mcp-entry", vaultPath: null, hints: [] });
	});

	it("returns no-mcp-entry when obsidian entry last arg is not a string (shape corruption)", async () => {
		// A non-string last element (e.g. null, a number) is unrecoverable shape
		// corruption — distinct from the empty-string cold-install state which is
		// deliberate. Both are no-mcp-entry because no vault path can be extracted.
		mockReadFile.mockResolvedValue(
			JSON.stringify({
				mcpServers: {
					obsidian: { command: "cmd", args: ["/c", "npx", "@bitbonsai/mcpvault", null] },
				},
			}),
		);

		const result = await buildBrainState("/project/root");

		expect(result).toEqual({ status: "no-mcp-entry", vaultPath: null, hints: [] });
	});

	it("returns ok with vaultPath when valid obsidian entry and stat resolves to a directory", async () => {
		const vaultPath = "/home/user/vault";
		mockReadFile.mockResolvedValue(makeMcpConfigWithObsidian(vaultPath));
		mockStat.mockResolvedValue(makeStatDir());

		const result = await buildBrainState("/project/root");

		expect(result).toEqual({ status: "ok", vaultPath, hints: [] });
	});

	it("returns invalid-path with vaultPath when stat rejects", async () => {
		const vaultPath = "/old/moved/path";
		mockReadFile.mockResolvedValue(makeMcpConfigWithObsidian(vaultPath));
		mockStat.mockRejectedValue(new Error("ENOENT"));

		const result = await buildBrainState("/project/root");

		expect(result).toEqual({ status: "invalid-path", vaultPath, hints: [] });
	});

	it("returns invalid-path with vaultPath when stat resolves but target is not a directory", async () => {
		const vaultPath = "/home/user/vault-is-a-file";
		mockReadFile.mockResolvedValue(makeMcpConfigWithObsidian(vaultPath));
		mockStat.mockResolvedValue(makeStatFile());

		const result = await buildBrainState("/project/root");

		expect(result).toEqual({ status: "invalid-path", vaultPath, hints: [] });
	});

	// Windows-shape regression: args prefix ["/c", "npx", "@bitbonsai/mcpvault", <path>].
	// The vault path is always the final positional arg — the helper must extract it
	// regardless of how many prefix elements precede it.
	it("extracts vault path from Windows-shaped args (last positional element rule)", async () => {
		const vaultPath = "/home/vault";
		mockReadFile.mockResolvedValue(
			JSON.stringify({
				mcpServers: {
					obsidian: {
						command: "cmd",
						args: ["/c", "npx", "@bitbonsai/mcpvault", vaultPath],
					},
				},
			}),
		);
		mockStat.mockResolvedValue(makeStatDir());

		const result = await buildBrainState("/project/root");

		expect(result).toEqual({ status: "ok", vaultPath, hints: [] });
	});

	it("includes discovered hints on every returned state", async () => {
		const hint = { source: "env" as const, path: "/mocked/brain" };
		mockResolveBrainHints.mockResolvedValue([hint]);

		// Use the ENOENT path so we get no-mcp-entry (simplest branch).
		const enoent = Object.assign(new Error("ENOENT"), { code: "ENOENT" });
		mockReadFile.mockRejectedValue(enoent);

		const result = await buildBrainState("/project/root");

		expect(result).toEqual({ status: "no-mcp-entry", vaultPath: null, hints: [hint] });
	});
});
