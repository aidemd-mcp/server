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

const OFF = { query: "", onlyOpen: false, onlyMisaligned: false, onlyPlans: false, onlyTodos: false };
const planChip = { kind: "plan", tone: "run", icon: "run", key: "plan.aide · approved", value: "1/3", file: "p" } as const;
const todoChip = { kind: "todo", tone: "danger", icon: "issues", key: "todo.aide", value: "1 open of 2", file: "t" } as const;

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

	it("keeps only nodes with a plan chip when `Has a plan` is on, whatever its status", () => {
		expect(matchesFilters({ entry: entry({ chips: [planChip] }), ...OFF, onlyPlans: true })).toBe(true);
		expect(matchesFilters({ entry: entry({ chips: [todoChip] }), ...OFF, onlyPlans: true })).toBe(false);
		expect(matchesFilters({ entry: entry(), ...OFF, onlyPlans: true })).toBe(false);
	});

	it("keeps only nodes with a todo chip when `Has a todo` is on", () => {
		expect(matchesFilters({ entry: entry({ chips: [todoChip] }), ...OFF, onlyTodos: true })).toBe(true);
		expect(matchesFilters({ entry: entry({ chips: [planChip] }), ...OFF, onlyTodos: true })).toBe(false);
		expect(matchesFilters({ entry: entry(), ...OFF, onlyTodos: true })).toBe(false);
	});

	it("needs both a plan and a todo when both toggles are on", () => {
		const both = { ...OFF, onlyPlans: true, onlyTodos: true };
		expect(matchesFilters({ entry: entry({ chips: [planChip, todoChip] }), ...both })).toBe(true);
		expect(matchesFilters({ entry: entry({ chips: [planChip] }), ...both })).toBe(false);
	});

	it("needs every filter that is on to hold", () => {
		const both = { ...OFF, query: "score", onlyOpen: true, onlyMisaligned: true };
		expect(matchesFilters({ entry: entry({ openWork: true, misaligned: true }), ...both })).toBe(true);
		expect(matchesFilters({ entry: entry({ openWork: true, misaligned: false }), ...both })).toBe(false);
		expect(matchesFilters({ entry: entry({ openWork: false, misaligned: true }), ...both })).toBe(false);
		expect(matchesFilters({ entry: entry({ openWork: true, misaligned: true, path: "src/other" }), ...both })).toBe(false);
	});
});
