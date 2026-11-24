import { describe, expect, it } from "vitest";
import parsePlanSteps from "./index.js";

describe("parsePlanSteps", () => {
	it("lists checkbox lines with an optional step number and marks lettered and indented items sub", () => {
		const text = [
			"- [x] 1. Read the parent spec",
			"- [x] 2. Extract the helper",
			"  - [x] 2a. Move the parser",
			"- [ ] 2b. Add the test",
			"- [ ] 3. Wire it in",
			"- [ ] no number here",
		].join("\n");
		expect(parsePlanSteps(text)).toEqual([
			{ number: "1", text: "Read the parent spec", loc: null, done: true, sub: false },
			{ number: "2", text: "Extract the helper", loc: null, done: true, sub: false },
			{ number: "2a", text: "Move the parser", loc: null, done: true, sub: true },
			{ number: "2b", text: "Add the test", loc: null, done: false, sub: true },
			{ number: "3", text: "Wire it in", loc: null, done: false, sub: false },
			{ number: null, text: "no number here", loc: null, done: false, sub: false },
		]);
	});

	it("reads a plan in the observer's format: one row per numbered step heading, its checkboxes as sub rows", () => {
		const text = [
			"---",
			"status: approved",
			"---",
			"## Plan",
			"### 1. Types",
			"Read: a",
			"- [x] Create types",
			"- [x] Create parser",
			"### 2. Drawer",
			"- [x] Drawer",
			"- [ ] Parsers",
			"### 3. Empty step",
			"## Decisions",
			"### Not a step",
			"- [ ] outside the plan",
		].join("\n");
		expect(parsePlanSteps(text)).toEqual([
			{ number: "1", text: "Types", loc: null, done: true, sub: false },
			{ number: null, text: "Create types", loc: null, done: true, sub: true },
			{ number: null, text: "Create parser", loc: null, done: true, sub: true },
			{ number: "2", text: "Drawer", loc: null, done: false, sub: false },
			{ number: null, text: "Parsers", loc: null, done: false, sub: true },
			{ number: "3", text: "Empty step", loc: null, done: false, sub: false },
		]);
	});

	it("folds a checkbox that repeats its heading into the heading row and nests lettered boxes under their step", () => {
		const text = [
			"## Plan",
			"",
			"### 1. Define ConformanceScore types",
			"",
			"- [x] Define ConformanceScore types",
			"",
			"### 2. Load playbook rules from the brain",
			"",
			"- [x] 2a. Resolve the coding-playbook hub via aide_brain",
			"- [ ] 2b. Walk hub to section to child notes",
			"",
			"### 3. Map each spec's scope",
			"",
			"- [ ] Map each spec's scope",
		].join("\n");
		expect(parsePlanSteps(text)).toEqual([
			{ number: "1", text: "Define ConformanceScore types", loc: null, done: true, sub: false },
			{ number: "2", text: "Load playbook rules from the brain", loc: null, done: false, sub: false },
			{ number: "2a", text: "Resolve the coding-playbook hub via aide_brain", loc: null, done: true, sub: true },
			{ number: "2b", text: "Walk hub to section to child notes", loc: null, done: false, sub: true },
			{ number: "3", text: "Map each spec's scope", loc: null, done: false, sub: false },
		]);
	});

	it("keeps several different checkboxes per step, as the observer's own plan.aide has them", () => {
		const text = [
			"### 1. Static assets: the shared body writer, the asset locator and GET /assets/:name",
			"",
			"- [x] Create `shared/sendBody/index.ts`: writes `status`",
			"- [x] Create `locatePageAssets/index.ts`: walks up three levels",
			"- [ ] Tests `routes/getAsset/index.test.ts`",
		].join("\n");
		const rows = parsePlanSteps(text);
		expect(rows).toHaveLength(4);
		expect(rows[0]).toEqual({
			number: "1",
			text: "Static assets: the shared body writer, the asset locator and GET /assets/:name",
			loc: null,
			done: false,
			sub: false,
		});
		expect(rows.slice(1).map((row) => row.sub)).toEqual([true, true, true]);
	});

	it("marks a step with a single folded checkbox done once that checkbox is checked", () => {
		expect(parsePlanSteps("### 1. Only\n- [x] only\n### 2. Next\n- [ ] Next")).toEqual([
			{ number: "1", text: "Only", loc: null, done: true, sub: false },
			{ number: "2", text: "Next", loc: null, done: false, sub: false },
		]);
	});

	it("gives no rows for a file with no checkboxes", () => {
		expect(parsePlanSteps("## Plan\nnothing")).toEqual([]);
	});
});
