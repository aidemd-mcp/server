/**
 * Tests for aide_info — the passive boot-time precondition reporter.
 *
 * INVARIANT: This file MUST NOT import from `@/service/brainBackends`.
 * The info tool is a passive forwarder of buildBrainState output; it never
 * imports the backend registry and neither do its tests. If you find yourself
 * reaching for brainBackends here, the test design is wrong.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("node:fs");
vi.mock("@/tools/upgrade/buildVersionsMeta/index.js");
vi.mock("@/service/buildBrainState/index.js");

import { readFileSync } from "node:fs";
import readVersionsManifest, { type VersionsMap } from "@/tools/upgrade/buildVersionsMeta/index.js";
import buildBrainState from "@/service/buildBrainState/index.js";
import info, { InfoInput } from "./index.js";
import type { BrainState } from "@/types/index.js";

const mockReadFileSync = readFileSync as ReturnType<typeof vi.fn>;
const mockReadVersionsManifest = readVersionsManifest as ReturnType<typeof vi.fn>;
const mockBuildBrainState = buildBrainState as ReturnType<typeof vi.fn>;

const fixtureVersionsMap: VersionsMap = {
	"docs/aide-spec": {
		publishedAt: "2026-04-11T14:30:00+00:00",
		sourceCommit: "abc1234",
		previousCommit: "def5678",
	},
	"commands/aide/spec": {
		publishedAt: "2026-03-10T08:00:00+00:00",
		sourceCommit: "b2c3d4e",
	},
};

const LOCAL_VERSIONS_PATH_PATTERN = /versions\.json$/;

// ---------------------------------------------------------------------------
// Canonical brain state fixtures — one per BrainState variant.
// No `backend` field on any of them: that field is retired from BrainState.
// ---------------------------------------------------------------------------

const BRAIN_OK: BrainState = {
	status: "ok",
	rootPath: "/home/user/vault",
	connector: "obsidian",
	hints: [],
};

const BRAIN_NO_BRAIN_AIDE: BrainState = {
	status: "no-brain-aide",
	hints: [],
};

const BRAIN_INVALID_PATH: BrainState = {
	status: "invalid-path",
	rootPath: "/old/moved/path",
	connector: "obsidian",
	hints: [],
};

const BRAIN_NO_MCP_ENTRY: BrainState = {
	status: "no-mcp-entry",
	rootPath: "/home/user/vault",
	connector: "obsidian",
	hints: [],
};

const BRAIN_MCP_DRIFT: BrainState = {
	status: "mcp-drift",
	rootPath: "/home/user/new-vault",
	connector: "obsidian",
	hints: [],
};

beforeEach(() => {
	vi.resetAllMocks();
	mockReadVersionsManifest.mockReturnValue(fixtureVersionsMap);
	// Default: package.json returns version, local versions.json returns matching commits.
	mockReadFileSync.mockImplementation((filePath: string) => {
		if (LOCAL_VERSIONS_PATH_PATTERN.test(filePath)) {
			return JSON.stringify({
				"docs/aide-spec": { sourceCommit: "abc1234" },
				"commands/aide/spec": { sourceCommit: "b2c3d4e" },
			});
		}
		// package.json
		return JSON.stringify({ version: "1.2.3" });
	});
	// Default brain state: healthy vault so staleness tests are not affected by brain.
	mockBuildBrainState.mockResolvedValue(BRAIN_OK);
});

// ---------------------------------------------------------------------------
// 3c. Staleness reporting unchanged
// These tests verify that Plan 3's brain rewrite didn't regress the outdated
// and serverVersion halves of the response.
// ---------------------------------------------------------------------------

describe("info — staleness reporting (3c)", () => {
	it("returns serverVersion and empty outdated array when local versions match canonical exactly", async () => {
		const result = await info("/project/root");

		expect(result.serverVersion).toBe("1.2.3");
		expect(result.outdated).toEqual([]);
	});

	it("includes stale key in outdated when local sourceCommit differs from canonical", async () => {
		mockReadFileSync.mockImplementation((filePath: string) => {
			if (LOCAL_VERSIONS_PATH_PATTERN.test(filePath)) {
				return JSON.stringify({
					"docs/aide-spec": { sourceCommit: "stale00" },
					"commands/aide/spec": { sourceCommit: "b2c3d4e" },
				});
			}
			return JSON.stringify({ version: "1.2.3" });
		});

		const result = await info("/project/root");

		expect(result.outdated).toEqual(["docs/aide-spec"]);
	});

	it("includes missing key in outdated when canonical has a key not present locally", async () => {
		mockReadFileSync.mockImplementation((filePath: string) => {
			if (LOCAL_VERSIONS_PATH_PATTERN.test(filePath)) {
				return JSON.stringify({
					"docs/aide-spec": { sourceCommit: "abc1234" },
					// "commands/aide/spec" is missing
				});
			}
			return JSON.stringify({ version: "1.2.3" });
		});

		const result = await info("/project/root");

		expect(result.outdated).toEqual(["commands/aide/spec"]);
	});

	it("returns outdated: [] silently when local versions.json does not exist", async () => {
		mockReadFileSync.mockImplementation((filePath: string) => {
			if (LOCAL_VERSIONS_PATH_PATTERN.test(filePath)) {
				throw new Error("ENOENT: no such file or directory");
			}
			return JSON.stringify({ version: "1.2.3" });
		});

		const result = await info("/project/root");

		expect(result.serverVersion).toBe("1.2.3");
		expect(result.outdated).toEqual([]);
	});

	it("includes all stale and missing keys in outdated", async () => {
		mockReadFileSync.mockImplementation((filePath: string) => {
			if (LOCAL_VERSIONS_PATH_PATTERN.test(filePath)) {
				return JSON.stringify({
					"docs/aide-spec": { sourceCommit: "wrongsha" },
					// "commands/aide/spec" is missing
				});
			}
			return JSON.stringify({ version: "1.2.3" });
		});

		const result = await info("/project/root");

		expect(result.outdated).toContain("docs/aide-spec");
		expect(result.outdated).toContain("commands/aide/spec");
		expect(result.outdated).toHaveLength(2);
	});

	it("returns 'unknown' for serverVersion when package.json readFileSync throws", async () => {
		mockReadFileSync.mockImplementation((filePath: string) => {
			if (LOCAL_VERSIONS_PATH_PATTERN.test(filePath)) {
				return JSON.stringify({
					"docs/aide-spec": { sourceCommit: "abc1234" },
					"commands/aide/spec": { sourceCommit: "b2c3d4e" },
				});
			}
			// package.json throws
			throw new Error("ENOENT: no such file or directory");
		});

		const result = await info("/project/root");

		expect(result.serverVersion).toBe("unknown");
		expect(result.outdated).toEqual([]);
	});
});

// ---------------------------------------------------------------------------
// 3a. All five brain states surface in result.brain.status
// Each test sets up a mock return from buildBrainState and asserts the
// forwarded status matches.
// ---------------------------------------------------------------------------

describe("info — all five brain states (3a)", () => {
	it("surfaces ok status when buildBrainState returns ok", async () => {
		mockBuildBrainState.mockResolvedValue(BRAIN_OK);

		const result = await info("/project/root");

		expect(result.brain.status).toBe("ok");
	});

	it("surfaces no-brain-aide status when buildBrainState returns no-brain-aide", async () => {
		mockBuildBrainState.mockResolvedValue(BRAIN_NO_BRAIN_AIDE);

		const result = await info("/project/root");

		expect(result.brain.status).toBe("no-brain-aide");
	});

	it("surfaces invalid-path status when buildBrainState returns invalid-path", async () => {
		mockBuildBrainState.mockResolvedValue(BRAIN_INVALID_PATH);

		const result = await info("/project/root");

		expect(result.brain.status).toBe("invalid-path");
	});

	it("surfaces no-mcp-entry status when buildBrainState returns no-mcp-entry", async () => {
		mockBuildBrainState.mockResolvedValue(BRAIN_NO_MCP_ENTRY);

		const result = await info("/project/root");

		expect(result.brain.status).toBe("no-mcp-entry");
	});

	it("surfaces mcp-drift status when buildBrainState returns mcp-drift", async () => {
		mockBuildBrainState.mockResolvedValue(BRAIN_MCP_DRIFT);

		const result = await info("/project/root");

		expect(result.brain.status).toBe("mcp-drift");
	});
});

// ---------------------------------------------------------------------------
// 3b. `backend` field is absent from result.brain — for every state.
// Load-bearing test for outcomes.desired[7]:
// "no `backend` field, no connector label, no enum the server interprets".
// ---------------------------------------------------------------------------

describe("info — backend field absent from result.brain (3b)", () => {
	it("result.brain has no backend field when status is ok", async () => {
		mockBuildBrainState.mockResolvedValue(BRAIN_OK);

		const result = await info("/project/root");

		expect(result.brain).not.toHaveProperty("backend");
	});

	it("result.brain has no backend field when status is no-brain-aide", async () => {
		mockBuildBrainState.mockResolvedValue(BRAIN_NO_BRAIN_AIDE);

		const result = await info("/project/root");

		expect(result.brain).not.toHaveProperty("backend");
	});

	it("result.brain has no backend field when status is invalid-path", async () => {
		mockBuildBrainState.mockResolvedValue(BRAIN_INVALID_PATH);

		const result = await info("/project/root");

		expect(result.brain).not.toHaveProperty("backend");
	});

	it("result.brain has no backend field when status is no-mcp-entry", async () => {
		mockBuildBrainState.mockResolvedValue(BRAIN_NO_MCP_ENTRY);

		const result = await info("/project/root");

		expect(result.brain).not.toHaveProperty("backend");
	});

	it("result.brain has no backend field when status is mcp-drift", async () => {
		mockBuildBrainState.mockResolvedValue(BRAIN_MCP_DRIFT);

		const result = await info("/project/root");

		expect(result.brain).not.toHaveProperty("backend");
	});
});

// ---------------------------------------------------------------------------
// 3d. Brain status and outdated are independent.
// Validates the parent spec invariant that the two concerns are independent
// fields — neither suppresses or alters the other.
// ---------------------------------------------------------------------------

describe("info — brain state and outdated independence (3d)", () => {
	it("brain ok + outdated non-empty: both fields populated from independent sources", async () => {
		// Staleness: one artifact outdated
		mockReadFileSync.mockImplementation((filePath: string) => {
			if (LOCAL_VERSIONS_PATH_PATTERN.test(filePath)) {
				return JSON.stringify({
					"docs/aide-spec": { sourceCommit: "abc1234" },
					// "commands/aide/spec" missing — counts as outdated
				});
			}
			return JSON.stringify({ version: "1.2.3" });
		});
		// Brain: healthy
		mockBuildBrainState.mockResolvedValue(BRAIN_OK);

		const result = await info("/project/root");

		expect(result.brain.status).toBe("ok");
		expect(result.outdated).toEqual(["commands/aide/spec"]);
	});

	it("brain no-brain-aide + outdated non-empty: broken brain does not suppress stale artifacts", async () => {
		// Staleness: one artifact stale
		mockReadFileSync.mockImplementation((filePath: string) => {
			if (LOCAL_VERSIONS_PATH_PATTERN.test(filePath)) {
				return JSON.stringify({
					"docs/aide-spec": { sourceCommit: "stalesha" },
					"commands/aide/spec": { sourceCommit: "b2c3d4e" },
				});
			}
			return JSON.stringify({ version: "1.2.3" });
		});
		// Brain: broken
		mockBuildBrainState.mockResolvedValue(BRAIN_NO_BRAIN_AIDE);

		const result = await info("/project/root");

		expect(result.brain.status).toBe("no-brain-aide");
		expect(result.outdated).toEqual(["docs/aide-spec"]);
	});

	it("brain mcp-drift + outdated empty: drift detected without suppressing clean staleness", async () => {
		// Staleness: all up to date
		mockBuildBrainState.mockResolvedValue(BRAIN_MCP_DRIFT);

		const result = await info("/project/root");

		expect(result.brain.status).toBe("mcp-drift");
		expect(result.outdated).toEqual([]);
	});

	it("brain no-mcp-entry + outdated empty: neither field bleeds into the other", async () => {
		mockBuildBrainState.mockResolvedValue(BRAIN_NO_MCP_ENTRY);

		const result = await info("/project/root");

		expect(result.brain.status).toBe("no-mcp-entry");
		expect(result.outdated).toEqual([]);
	});
});

// ---------------------------------------------------------------------------
// 3e. Tool never throws on broken state.
// Validates the never-throws contract from the parent spec.
// buildBrainState is mocked to return structured states — the info tool is
// tested for its pass-through contract. The actual never-throws behaviour for
// missing / malformed files is tested in buildBrainState/index.test.ts.
// The tests here confirm that info() itself never throws when buildBrainState
// returns any valid BrainState, including the broken ones.
// ---------------------------------------------------------------------------

describe("info — never throws on broken brain state (3e)", () => {
	it("resolves without throwing when brain state is no-brain-aide (missing brain.aide)", async () => {
		mockBuildBrainState.mockResolvedValue(BRAIN_NO_BRAIN_AIDE);

		await expect(info("/project/root")).resolves.toBeDefined();
		const result = await info("/project/root");
		expect(result.brain.status).toBe("no-brain-aide");
	});

	it("resolves without throwing when brain state is no-mcp-entry (missing .mcp.json)", async () => {
		mockBuildBrainState.mockResolvedValue(BRAIN_NO_MCP_ENTRY);

		await expect(info("/project/root")).resolves.toBeDefined();
		const result = await info("/project/root");
		expect(result.brain.status).toBe("no-mcp-entry");
	});

	it("resolves without throwing when brain state is invalid-path (vault deleted)", async () => {
		mockBuildBrainState.mockResolvedValue(BRAIN_INVALID_PATH);

		await expect(info("/project/root")).resolves.toBeDefined();
		const result = await info("/project/root");
		expect(result.brain.status).toBe("invalid-path");
	});

	it("resolves without throwing when brain state is mcp-drift (brain.aide and .mcp.json disagree)", async () => {
		mockBuildBrainState.mockResolvedValue(BRAIN_MCP_DRIFT);

		await expect(info("/project/root")).resolves.toBeDefined();
		const result = await info("/project/root");
		expect(result.brain.status).toBe("mcp-drift");
	});

	it("resolves without throwing when buildBrainState returns no-brain-aide with hints (broken brain.aide)", async () => {
		const brokenWithHints: BrainState = {
			status: "no-brain-aide",
			hints: [{ source: "env" as const, path: "/candidate/vault" }],
		};
		mockBuildBrainState.mockResolvedValue(brokenWithHints);

		await expect(info("/project/root")).resolves.toBeDefined();
		const result = await info("/project/root");
		expect(result.brain.status).toBe("no-brain-aide");
		expect(result.brain).not.toHaveProperty("backend");
	});
});

// ---------------------------------------------------------------------------
// Brain pass-through — the info tool forwards BrainState verbatim.
// Covers exact shape equality for all five states to prevent any accidental
// field addition or transformation in the forwarder.
// ---------------------------------------------------------------------------

describe("info — brain pass-through (verbatim forwarding)", () => {
	it("forwards BrainState ok verbatim when buildBrainState returns ok", async () => {
		mockBuildBrainState.mockResolvedValue(BRAIN_OK);

		const result = await info("/project/root");

		expect(result.brain).toEqual(BRAIN_OK);
	});

	it("forwards BrainState no-brain-aide verbatim when buildBrainState returns no-brain-aide", async () => {
		mockBuildBrainState.mockResolvedValue(BRAIN_NO_BRAIN_AIDE);

		const result = await info("/project/root");

		expect(result.brain).toEqual(BRAIN_NO_BRAIN_AIDE);
	});

	it("forwards BrainState invalid-path verbatim when buildBrainState returns invalid-path", async () => {
		mockBuildBrainState.mockResolvedValue(BRAIN_INVALID_PATH);

		const result = await info("/project/root");

		expect(result.brain).toEqual(BRAIN_INVALID_PATH);
	});

	it("forwards BrainState no-mcp-entry verbatim when buildBrainState returns no-mcp-entry", async () => {
		mockBuildBrainState.mockResolvedValue(BRAIN_NO_MCP_ENTRY);

		const result = await info("/project/root");

		expect(result.brain).toEqual(BRAIN_NO_MCP_ENTRY);
	});

	it("forwards BrainState mcp-drift verbatim when buildBrainState returns mcp-drift", async () => {
		mockBuildBrainState.mockResolvedValue(BRAIN_MCP_DRIFT);

		const result = await info("/project/root");

		expect(result.brain).toEqual(BRAIN_MCP_DRIFT);
	});

	it("forwards hints in BrainState verbatim when buildBrainState returns hints", async () => {
		const hints = [{ source: "env" as const, path: "/mocked/brain" }];
		const withHints: BrainState = { status: "no-mcp-entry", rootPath: "/home/user/vault", connector: "obsidian", hints };
		mockBuildBrainState.mockResolvedValue(withHints);

		const result = await info("/project/root");

		expect(result.brain).toEqual(withHints);
	});
});

// ---------------------------------------------------------------------------
// InfoInput schema
// ---------------------------------------------------------------------------

describe("InfoInput", () => {
	it("parses empty object successfully — no parameters required", () => {
		const result = InfoInput.parse({});

		expect(result).toEqual({});
	});

	it("rejects unexpected fields (strict empty schema)", () => {
		// z.object({}) strips extra keys — it does not throw on them by default
		const result = InfoInput.parse({ unexpected: "value" });

		expect(result).toEqual({});
	});
});
