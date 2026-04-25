import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/service/install/detectFramework/index.js");
vi.mock("@/service/install/resolveBrainHints/index.js");
vi.mock("node:fs/promises");
vi.mock("@/service/brainBackends/index.js");

import detectFramework from "@/service/install/detectFramework/index.js";
import resolveBrainHints from "@/service/install/resolveBrainHints/index.js";
import { readFile, stat } from "node:fs/promises";
import resolveBackend from "@/service/brainBackends/index.js";
import buildBrainState from "@/service/buildBrainState/index.js";

const mockDetectFramework = detectFramework as ReturnType<typeof vi.fn>;
const mockResolveBrainHints = resolveBrainHints as ReturnType<typeof vi.fn>;
const mockReadFile = readFile as ReturnType<typeof vi.fn>;
const mockStat = stat as ReturnType<typeof vi.fn>;
const mockResolveBackend = resolveBackend as ReturnType<typeof vi.fn>;

// Factory functions — build MCP config JSON fixtures.

function makeMcpConfigWithBrain(vaultPath: string): string {
	return JSON.stringify({
		mcpServers: {
			brain: {
				command: "npx",
				args: ["@bitbonsai/mcpvault", vaultPath],
			},
		},
	});
}

function makeMcpConfigWithoutBrain(): string {
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
		// Default: registry recognises the entry as the obsidian backend.
		mockResolveBackend.mockReturnValue({ id: "obsidian", renderInstructions: vi.fn() });
	});

	it("returns no-mcp-entry when readFile rejects with ENOENT", async () => {
		const enoent = Object.assign(new Error("ENOENT: no such file or directory"), { code: "ENOENT" });
		mockReadFile.mockRejectedValue(enoent);

		const result = await buildBrainState("/project/root");

		expect(result).toEqual({ status: "no-mcp-entry", vaultPath: null, hints: [], backend: null });
	});

	it("returns no-mcp-entry when readFile returns malformed JSON", async () => {
		mockReadFile.mockResolvedValue(MALFORMED_JSON);

		const result = await buildBrainState("/project/root");

		expect(result).toEqual({ status: "no-mcp-entry", vaultPath: null, hints: [], backend: null });
	});

	it("returns no-mcp-entry when mcpServers is present but has no brain key", async () => {
		mockReadFile.mockResolvedValue(makeMcpConfigWithoutBrain());

		const result = await buildBrainState("/project/root");

		expect(result).toEqual({ status: "no-mcp-entry", vaultPath: null, hints: [], backend: null });
	});

	it("returns no-mcp-entry when brain entry has an empty args array", async () => {
		mockReadFile.mockResolvedValue(
			JSON.stringify({
				mcpServers: {
					brain: { command: "npx", args: [] },
				},
			}),
		);

		const result = await buildBrainState("/project/root");

		expect(result).toEqual({ status: "no-mcp-entry", vaultPath: null, hints: [], backend: null });
	});

	it("returns invalid-path with empty vaultPath when brain entry has an empty-string last arg (cold-install state)", async () => {
		// The CLI writes a brain entry with an empty vault path on cold install
		// so the orchestrator's inline-recovery flow can prompt the user for the path.
		// This must surface as invalid-path (not no-mcp-entry) so the orchestrator
		// fires the AskUserQuestion branch rather than telling the user to re-run init.
		mockReadFile.mockResolvedValue(makeMcpConfigWithBrain(""));

		const result = await buildBrainState("/project/root");

		expect(result).toEqual({ status: "invalid-path", vaultPath: "", hints: [], backend: null });
	});

	it("returns no-mcp-entry when brain entry has no args field", async () => {
		mockReadFile.mockResolvedValue(
			JSON.stringify({
				mcpServers: {
					brain: { command: "npx" },
				},
			}),
		);

		const result = await buildBrainState("/project/root");

		expect(result).toEqual({ status: "no-mcp-entry", vaultPath: null, hints: [], backend: null });
	});

	it("returns no-mcp-entry when brain entry has args that is not an array", async () => {
		mockReadFile.mockResolvedValue(
			JSON.stringify({
				mcpServers: {
					brain: { command: "npx", args: "/home/vault" },
				},
			}),
		);

		const result = await buildBrainState("/project/root");

		expect(result).toEqual({ status: "no-mcp-entry", vaultPath: null, hints: [], backend: null });
	});

	it("returns no-mcp-entry when brain entry last arg is not a string (shape corruption)", async () => {
		// A non-string last element (e.g. null, a number) is unrecoverable shape
		// corruption — distinct from the empty-string cold-install state which is
		// deliberate. Both are no-mcp-entry because no vault path can be extracted.
		mockReadFile.mockResolvedValue(
			JSON.stringify({
				mcpServers: {
					brain: { command: "cmd", args: ["/c", "npx", "@bitbonsai/mcpvault", null] },
				},
			}),
		);

		const result = await buildBrainState("/project/root");

		expect(result).toEqual({ status: "no-mcp-entry", vaultPath: null, hints: [], backend: null });
	});

	it("returns ok with vaultPath when valid brain entry and stat resolves to a directory", async () => {
		const vaultPath = "/home/user/vault";
		mockReadFile.mockResolvedValue(makeMcpConfigWithBrain(vaultPath));
		mockStat.mockResolvedValue(makeStatDir());

		const result = await buildBrainState("/project/root");

		expect(result).toEqual({ status: "ok", vaultPath, hints: [], backend: "obsidian" });
		// Registry dispatch: resolveBackend was called once with the entry the fixture produced.
		// Pins both the registry-dispatch contract and the "store driver.id, not the driver object" decision.
		expect(mockResolveBackend).toHaveBeenCalledTimes(1);
		expect(mockResolveBackend).toHaveBeenCalledWith(
			expect.objectContaining({ command: "npx", args: expect.arrayContaining([vaultPath]) }),
		);
	});

	it("returns invalid-path with vaultPath when stat rejects", async () => {
		const vaultPath = "/old/moved/path";
		mockReadFile.mockResolvedValue(makeMcpConfigWithBrain(vaultPath));
		mockStat.mockRejectedValue(new Error("ENOENT"));

		const result = await buildBrainState("/project/root");

		expect(result).toEqual({ status: "invalid-path", vaultPath, hints: [], backend: null });
	});

	it("returns invalid-path with vaultPath when stat resolves but target is not a directory", async () => {
		const vaultPath = "/home/user/vault-is-a-file";
		mockReadFile.mockResolvedValue(makeMcpConfigWithBrain(vaultPath));
		mockStat.mockResolvedValue(makeStatFile());

		const result = await buildBrainState("/project/root");

		expect(result).toEqual({ status: "invalid-path", vaultPath, hints: [], backend: null });
	});

	// Windows-shape regression: args prefix ["/c", "npx", "@bitbonsai/mcpvault", <path>].
	// The vault path is always the final positional arg — the helper must extract it
	// regardless of how many prefix elements precede it.
	it("extracts vault path from Windows-shaped args (last positional element rule)", async () => {
		const vaultPath = "/home/vault";
		mockReadFile.mockResolvedValue(
			JSON.stringify({
				mcpServers: {
					brain: {
						command: "cmd",
						args: ["/c", "npx", "@bitbonsai/mcpvault", vaultPath],
					},
				},
			}),
		);
		mockStat.mockResolvedValue(makeStatDir());

		const result = await buildBrainState("/project/root");

		expect(result).toEqual({ status: "ok", vaultPath, hints: [], backend: "obsidian" });
	});

	it("includes discovered hints on every returned state", async () => {
		const hint = { source: "env" as const, path: "/mocked/brain" };
		mockResolveBrainHints.mockResolvedValue([hint]);

		// Use the ENOENT path so we get no-mcp-entry (simplest branch).
		const enoent = Object.assign(new Error("ENOENT"), { code: "ENOENT" });
		mockReadFile.mockRejectedValue(enoent);

		const result = await buildBrainState("/project/root");

		expect(result).toEqual({ status: "no-mcp-entry", vaultPath: null, hints: [hint], backend: null });
	});

	it("returns no-mcp-entry with backend: null when resolveBackend returns null (wired-but-unrecognized backend)", async () => {
		mockReadFile.mockResolvedValue(makeMcpConfigWithBrain("/some/vault"));
		mockResolveBackend.mockReturnValue(null);
		// stat is never reached on this branch — but the test does not
		// need to assert that; the result-shape assertion is sufficient.

		const result = await buildBrainState("/project/root");

		expect(result).toEqual({ status: "no-mcp-entry", vaultPath: null, hints: [], backend: null });
		// Pins the registry-dispatch contract: resolveBackend was called once
		// with an entry whose command is "npx" and whose args ends with "/some/vault".
		expect(mockResolveBackend).toHaveBeenCalledTimes(1);
		expect(mockResolveBackend).toHaveBeenCalledWith(
			expect.objectContaining({
				command: "npx",
				args: expect.arrayContaining(["/some/vault"]),
			}),
		);
	});
});
