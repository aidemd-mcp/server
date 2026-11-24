import { describe, expect, it } from "vitest";
import type { TreeEntry } from "@/observer/page/types/index.js";
import matchesFilters from "./index.js";

function entry(overrides: Partial<TreeEntry> = {}): TreeEntry {
	return {
		folder: "src/tools/Score",
		path: "src/tools/Score",
		depth: 2,
		description: null,
		alignment: "aligned",
		chips: [],
		current: null,
		misaligned: false,
		hasChildren: false,
		ancestors: [".", "src"],
		descendants: 0,
		openWork: false,
		...overrides,
	};
}

const OFF = { query: "", onlyOpen: false, onlyMisaligned: false };

describe("matchesFilters", () => {
	it("passes every node when no filter is on", () => {
		expect(matchesFilters({ entry: entry(), ...OFF })).toBe(true);
	});

	it("matches the query against the full path, in any case (the query is already lower case)", () => {
		expect(matchesFilters({ entry: entry(), ...OFF, query: "tools/score" })).toBe(true);
		expect(matchesFilters({ entry: entry(), ...OFF, query: "src/tools" })).toBe(true);
		expect(matchesFilters({ entry: entry(), ...OFF, query: "crawl" })).toBe(false);
	});

	it("keeps only nodes with open work when `Only open work` is on", () => {
		expect(matchesFilters({ entry: entry({ openWork: true }), ...OFF, onlyOpen: true })).toBe(true);
		expect(matchesFilters({ entry: entry({ openWork: false }), ...OFF, onlyOpen: true })).toBe(false);
	});

	it("keeps only misaligned nodes when `Only misaligned` is on", () => {
		expect(matchesFilters({ entry: entry({ misaligned: true }), ...OFF, onlyMisaligned: true })).toBe(true);
		expect(matchesFilters({ entry: entry({ misaligned: false }), ...OFF, onlyMisaligned: true })).toBe(false);
	});

	it("needs every filter that is on to hold", () => {
		const both = { query: "score", onlyOpen: true, onlyMisaligned: true };
		expect(matchesFilters({ entry: entry({ openWork: true, misaligned: true }), ...both })).toBe(true);
		expect(matchesFilters({ entry: entry({ openWork: true, misaligned: false }), ...both })).toBe(false);
		expect(matchesFilters({ entry: entry({ openWork: false, misaligned: true }), ...both })).toBe(false);
		expect(matchesFilters({ entry: entry({ openWork: true, misaligned: true, path: "src/other" }), ...both })).toBe(false);
	});
});
