import { describe, expect, it } from "vitest";
import type { ModuleRow } from "@/observer/page/types/index.js";
import buildPlanRow from "./index.js";

type Plan = NonNullable<ModuleRow["plan"]>;

const module: ModuleRow = {
	folder: "src/tools/score",
	label: "src/tools/score",
	description: null,
	alignment: null,
	intentFile: null,
	brief: null,
	plan: null,
	todo: null,
	research: null,
	malformed: [],
};

const plan = (overrides: Partial<Plan> = {}): Plan => ({ file: "src/tools/score/plan.aide", status: "approved", done: 3, total: 9, ...overrides });

describe("buildPlanRow", () => {
	it("words the plan's status badge, step count and bar", () => {
		expect(buildPlanRow({ module, plan: plan(), current: null })).toEqual({
			module: "src/tools/score",
			kind: "plan",
			status: "Approved",
			tone: "run",
			icon: "run",
			progress: "3/9 steps",
			percent: 33,
			highlighted: false,
			item: { kind: "file", path: "src/tools/score/plan.aide" },
		});
	});

	it("opens the plan file as the drawer item", () => {
		expect(buildPlanRow({ module, plan: plan({ file: "x/plan.aide" }), current: null }).item).toEqual({ kind: "file", path: "x/plan.aide" });
	});

	it("prints the module's label, not its folder", () => {
		expect(buildPlanRow({ module: { ...module, label: "score" }, plan: plan(), current: null }).module).toBe("score");
	});

	it("highlights the current module's row only", () => {
		expect(buildPlanRow({ module, plan: plan(), current: "src/tools/score" }).highlighted).toBe(true);
		expect(buildPlanRow({ module, plan: plan(), current: "src/other" }).highlighted).toBe(false);
	});

	it("reads an unset status as `No status`", () => {
		const row = buildPlanRow({ module, plan: plan({ status: "unset" }), current: null });
		expect(row).toMatchObject({ status: "No status", tone: "outline", icon: "todo" });
	});

	it("falls back to `No status` for a status the page does not know", () => {
		const row = buildPlanRow({ module, plan: plan({ status: "weird" as Plan["status"] }), current: null });
		expect(row.status).toBe("No status");
	});

	it("shows an empty plan as 0 percent", () => {
		expect(buildPlanRow({ module, plan: plan({ done: 0, total: 0 }), current: null })).toMatchObject({ progress: "0/0 steps", percent: 0 });
	});
});
