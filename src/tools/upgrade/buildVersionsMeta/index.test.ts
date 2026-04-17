import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("node:fs");

import { readFileSync } from "node:fs";
import readVersionsManifest, { type VersionMeta, type VersionsMap } from "./index.js";

const mockReadFileSync = readFileSync as ReturnType<typeof vi.fn>;

const sampleMeta: VersionMeta = {
	publishedAt: "2026-04-11T14:30:00+00:00",
	sourceCommit: "abc1234",
	previousCommit: "def5678",
};

const sampleMap: VersionsMap = {
	"docs/aide-spec": sampleMeta,
	"commands/aide/spec": {
		publishedAt: "2026-03-10T08:00:00+00:00",
		sourceCommit: "b2c3d4e",
	},
};

beforeEach(() => {
	vi.resetAllMocks();
});

describe("readVersionsManifest", () => {
	it("returns parsed VersionsMap when versions.json exists", () => {
		mockReadFileSync.mockReturnValue(JSON.stringify(sampleMap));

		const result = readVersionsManifest();

		expect(result).toEqual(sampleMap);
	});

	it("returns empty object when readFileSync throws", () => {
		mockReadFileSync.mockImplementation(() => {
			throw new Error("ENOENT: no such file or directory");
		});

		const result = readVersionsManifest();

		expect(result).toEqual({});
	});

	it("returns entry with all VersionMeta fields when present", () => {
		mockReadFileSync.mockReturnValue(
			JSON.stringify({
				"docs/aide-spec": {
					publishedAt: "2026-04-11T14:30:00+00:00",
					sourceCommit: "abc1234",
					previousCommit: "def5678",
				},
			}),
		);

		const result = readVersionsManifest();
		const entry = result["docs/aide-spec"];

		expect(entry).toBeDefined();
		expect(entry.publishedAt).toBe("2026-04-11T14:30:00+00:00");
		expect(entry.sourceCommit).toBe("abc1234");
		expect(entry.previousCommit).toBe("def5678");
	});

	it("returns entry without previousCommit when it is absent", () => {
		mockReadFileSync.mockReturnValue(
			JSON.stringify({
				"commands/aide/spec": {
					publishedAt: "2026-03-10T08:00:00+00:00",
					sourceCommit: "b2c3d4e",
				},
			}),
		);

		const result = readVersionsManifest();
		const entry = result["commands/aide/spec"];

		expect(entry).toBeDefined();
		expect(entry.publishedAt).toBe("2026-03-10T08:00:00+00:00");
		expect(entry.sourceCommit).toBe("b2c3d4e");
		expect(entry.previousCommit).toBeUndefined();
	});

	it("returns all entries from a multi-artifact manifest", () => {
		mockReadFileSync.mockReturnValue(JSON.stringify(sampleMap));

		const result = readVersionsManifest();

		expect(Object.keys(result)).toHaveLength(2);
		expect(result["docs/aide-spec"]).toEqual(sampleMeta);
		expect(result["commands/aide/spec"]).toEqual(sampleMap["commands/aide/spec"]);
	});
});
