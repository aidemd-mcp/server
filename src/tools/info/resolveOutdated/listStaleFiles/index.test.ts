import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("node:fs");
vi.mock("@/tools/upgrade/buildVersionsMeta/index.js");

import { readFileSync } from "node:fs";
import readVersionsManifest, { type VersionsMap } from "@/tools/upgrade/buildVersionsMeta/index.js";
import listStaleFiles from "./index.js";

const mockReadFileSync = readFileSync as ReturnType<typeof vi.fn>;
const mockReadVersionsManifest = readVersionsManifest as ReturnType<typeof vi.fn>;

const root = "/project/root";

function makeManifest(): VersionsMap {
	return {
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
}

describe("listStaleFiles", () => {
	beforeEach(() => {
		vi.resetAllMocks();
		mockReadVersionsManifest.mockReturnValue(makeManifest());
	});

	it("returns [] when every local sourceCommit matches the canonical manifest", () => {
		mockReadFileSync.mockReturnValue(
			JSON.stringify({
				"docs/aide-spec": { sourceCommit: "abc1234" },
				"commands/aide/spec": { sourceCommit: "b2c3d4e" },
			}),
		);

		expect(listStaleFiles(root)).toEqual([]);
	});

	it("includes a key whose local sourceCommit differs from canonical", () => {
		mockReadFileSync.mockReturnValue(
			JSON.stringify({
				"docs/aide-spec": { sourceCommit: "stale00" },
				"commands/aide/spec": { sourceCommit: "b2c3d4e" },
			}),
		);

		expect(listStaleFiles(root)).toEqual(["docs/aide-spec"]);
	});

	it("includes a canonical key that is missing locally", () => {
		mockReadFileSync.mockReturnValue(JSON.stringify({ "docs/aide-spec": { sourceCommit: "abc1234" } }));

		expect(listStaleFiles(root)).toEqual(["commands/aide/spec"]);
	});

	it("returns the stale keys in canonical manifest order", () => {
		mockReadFileSync.mockReturnValue(JSON.stringify({}));

		expect(listStaleFiles(root)).toEqual(["docs/aide-spec", "commands/aide/spec"]);
	});

	it("returns [] silently when versions.json does not exist", () => {
		mockReadFileSync.mockImplementation(() => {
			throw new Error("ENOENT: no such file or directory");
		});

		expect(listStaleFiles(root)).toEqual([]);
	});

	it("reads versions.json under the project's .aide folder", () => {
		mockReadFileSync.mockReturnValue(JSON.stringify({}));

		listStaleFiles(root);

		expect(mockReadFileSync).toHaveBeenCalledWith(expect.stringMatching(/\.aide[\\/]versions\.json$/), "utf-8");
	});
});
