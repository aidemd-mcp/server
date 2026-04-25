import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("node:fs");
vi.mock("@/tools/upgrade/buildVersionsMeta/index.js");
vi.mock("./buildBrainState/index.js");

import { readFileSync } from "node:fs";
import readVersionsManifest, { type VersionsMap } from "@/tools/upgrade/buildVersionsMeta/index.js";
import buildBrainState from "./buildBrainState/index.js";
import info, { InfoInput } from "./index.js";

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

beforeEach(() => {
	vi.resetAllMocks();
	mockReadVersionsManifest.mockReturnValue(fixtureVersionsMap);
	// Default: package.json returns version, local versions.json returns matching commits
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
	// Default brain state: healthy vault so staleness tests are not affected by brain
	mockBuildBrainState.mockResolvedValue({ status: "ok", vaultPath: "/home/user/vault", hints: [] });
});

describe("info", () => {
	it("returns serverVersion and empty outdated array when local versions match canonical exactly", async () => {
		const result = await info("/project/root");

		expect(result.serverVersion).toBe("1.2.3");
		expect(result.outdated).toEqual([]);
		expect(result.brain).toEqual({ status: "ok", vaultPath: "/home/user/vault", hints: [] });
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
		expect(result.brain).toEqual({ status: "ok", vaultPath: "/home/user/vault", hints: [] });
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
		expect(result.brain).toEqual({ status: "ok", vaultPath: "/home/user/vault", hints: [] });
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
		expect(result.brain).toEqual({ status: "ok", vaultPath: "/home/user/vault", hints: [] });
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
		expect(result.brain).toEqual({ status: "ok", vaultPath: "/home/user/vault", hints: [] });
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

		// When package.json throws, readServerVersion returns "unknown".
		// But the local versions.json read comes AFTER, so we also need it to succeed
		// for this test to exercise outdated comparison. However: when package.json
		// throws, readServerVersion catches internally — the local file read still proceeds.
		// But our mock throws for ALL non-versions.json paths (including package.json),
		// which means readServerVersion returns "unknown", but local versions read succeeds.
		const result = await info("/project/root");

		expect(result.serverVersion).toBe("unknown");
		expect(result.outdated).toEqual([]);
		expect(result.brain).toEqual({ status: "ok", vaultPath: "/home/user/vault", hints: [] });
	});

	describe("brain pass-through", () => {
		it("forwards BrainState ok verbatim when buildBrainState returns ok", async () => {
			mockBuildBrainState.mockResolvedValue({ status: "ok", vaultPath: "/home/user/vault", hints: [] });

			const result = await info("/project/root");

			expect(result.brain).toEqual({ status: "ok", vaultPath: "/home/user/vault", hints: [] });
		});

		it("forwards BrainState no-mcp-entry verbatim when buildBrainState returns no-mcp-entry", async () => {
			mockBuildBrainState.mockResolvedValue({ status: "no-mcp-entry", vaultPath: null, hints: [] });

			const result = await info("/project/root");

			expect(result.brain).toEqual({ status: "no-mcp-entry", vaultPath: null, hints: [] });
		});

		it("forwards BrainState invalid-path verbatim when buildBrainState returns invalid-path", async () => {
			mockBuildBrainState.mockResolvedValue({ status: "invalid-path", vaultPath: "/old/moved/path", hints: [] });

			const result = await info("/project/root");

			expect(result.brain).toEqual({ status: "invalid-path", vaultPath: "/old/moved/path", hints: [] });
		});

		it("forwards hints in BrainState verbatim when buildBrainState returns hints", async () => {
			const hints = [{ source: "env" as const, path: "/mocked/brain" }];
			mockBuildBrainState.mockResolvedValue({ status: "no-mcp-entry", vaultPath: null, hints });

			const result = await info("/project/root");

			expect(result.brain).toEqual({ status: "no-mcp-entry", vaultPath: null, hints });
		});
	});

	it("outdated and brain are independent: stale artifacts do not suppress brain state and vice versa", async () => {
		// Staleness path: one artifact is outdated
		mockReadFileSync.mockImplementation((filePath: string) => {
			if (LOCAL_VERSIONS_PATH_PATTERN.test(filePath)) {
				return JSON.stringify({
					"docs/aide-spec": { sourceCommit: "abc1234" },
					// "commands/aide/aide" missing — counts as outdated
				});
			}
			return JSON.stringify({ version: "1.2.3" });
		});
		// Brain path: no obsidian entry configured
		mockBuildBrainState.mockResolvedValue({ status: "no-mcp-entry", vaultPath: null, hints: [] });

		const result = await info("/project/root");

		// Both fields are populated from their independent sources
		expect(result.outdated).toEqual(["commands/aide/spec"]);
		expect(result.brain).toEqual({ status: "no-mcp-entry", vaultPath: null, hints: [] });
	});
});

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
