import { describe, expect, it } from "vitest";
import makeFile from "@/observer/page/__fixtures__/makeFile/index.js";
import makeStatus from "@/observer/page/__fixtures__/makeStatus/index.js";
import SCORE_NODE from "@/observer/page/__fixtures__/SCORE_NODE/index.js";
import findPlanSteps from "./index.js";

describe("findPlanSteps", () => {
	it("is the plan's numbered steps done and in total", () => {
		const status = makeStatus({ tree: [SCORE_NODE] });
		expect(findPlanSteps({ status, module: "src/tools/score" })).toEqual({ done: 3, total: 9 });
	});

	it("is null with no status", () => {
		expect(findPlanSteps({ status: null, module: "src/tools/score" })).toBeNull();
	});

	it("is null when no module is named", () => {
		expect(findPlanSteps({ status: makeStatus({ tree: [SCORE_NODE] }), module: null })).toBeNull();
	});

	it("is null for a module the tree does not hold", () => {
		expect(findPlanSteps({ status: makeStatus({ tree: [SCORE_NODE] }), module: "src/other" })).toBeNull();
	});

	it("is null for a module with no plan file", () => {
		const node = { ...SCORE_NODE, files: SCORE_NODE.files.filter((file) => file.kind !== "plan") };
		expect(findPlanSteps({ status: makeStatus({ tree: [node] }), module: "src/tools/score" })).toBeNull();
	});

	it("is null when the plan file could not be read", () => {
		const plan = { ...makeFile({ kind: "plan", folder: "src/tools/score", file: "src/tools/score/plan.aide" }), read: { state: "unreadable", error: "gone" } } as never;
		const node = { ...SCORE_NODE, files: [plan] };
		expect(findPlanSteps({ status: makeStatus({ tree: [node] }), module: "src/tools/score" })).toBeNull();
	});
});
