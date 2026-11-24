import { describe, expect, it } from "vitest";
import buildTypeChips from "./index.js";

describe("buildTypeChips", () => {
	it("offers only `All` with nothing to filter", () => {
		expect(buildTypeChips({ counts: {} })).toEqual([{ id: "all", label: "All" }]);
	});

	it("lists each category that has rows, with its count, in the handoff's order", () => {
		const chips = buildTypeChips({ counts: { errors: 1, phases: 7, qa: 2, files: 3, sessions: 1, commits: 0, prompts: 4, tasks: 2, gates: 1 } });
		expect(chips.map((chip) => chip.label)).toEqual(["All", "Phases 7", "Gates 1", "QA 2", "Tasks 2", "Files 3", "Prompts 4", "Errors 1"]);
	});

	it("never offers the sessions category", () => {
		expect(buildTypeChips({ counts: { sessions: 5 } }).map((chip) => chip.id)).toEqual(["all"]);
	});
});
