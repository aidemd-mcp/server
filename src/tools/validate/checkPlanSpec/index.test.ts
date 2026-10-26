import { describe, it, expect } from "vitest";
import type { AideFile } from "@/types/index.js";
import checkPlanSpec from "./index.js";

function makeFile(relativePath: string): AideFile {
	return { path: `/proj/${relativePath}`, relativePath, type: "intent", summary: "" };
}

const message = "plan.aide has no intent spec (.aide or intent.aide) beside it; write the folder's intent spec first.";

describe("checkPlanSpec", () => {
	it("warns for a plan alone, naming the plan file", () => {
		expect(checkPlanSpec([makeFile("src/a/plan.aide")])).toEqual([
			{ kind: "plan-without-spec", path: "src/a/plan.aide", message },
		]);
	});

	it.each([".aide", "intent.aide"])("passes a plan beside %s", (spec) => {
		expect(checkPlanSpec([makeFile("src/a/plan.aide"), makeFile(`src/a/${spec}`)])).toEqual([]);
	});

	it.each([["research.aide"], ["session.aide"], ["brief.aide", "todo.aide"]])(
		"still warns when the folder holds only %s",
		(...others) => {
			const files = [makeFile(".aide/plan.aide"), ...others.map((name) => makeFile(`.aide/${name}`))];
			const warnings = checkPlanSpec(files);
			expect(warnings).toHaveLength(1);
			expect(warnings[0].path).toBe(".aide/plan.aide");
		},
	);

	it("warns only for the folder without a spec", () => {
		const warnings = checkPlanSpec([
			makeFile("src/a/plan.aide"),
			makeFile("src/a/.aide"),
			makeFile("src/b/plan.aide"),
		]);
		expect(warnings.map((w) => w.path)).toEqual(["src/b/plan.aide"]);
	});

	it("returns nothing when no plan exists", () => {
		expect(checkPlanSpec([makeFile("src/a/.aide"), makeFile("src/b/todo.aide")])).toEqual([]);
	});
});
