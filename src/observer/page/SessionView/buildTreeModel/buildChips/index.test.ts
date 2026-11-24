import { describe, expect, it } from "vitest";
import type { ModuleRow } from "@/observer/page/types/index.js";
import buildChips from "./index.js";

function makeModule(overrides: Partial<ModuleRow> = {}): ModuleRow {
	return {
		folder: "src/a",
		label: "src/a",
		description: null,
		alignment: null,
		intentFile: null,
		brief: null,
		plan: null,
		todo: null,
		research: null,
		malformed: [],
		...overrides,
	};
}

function planOf(status: NonNullable<ModuleRow["plan"]>["status"], done = 3, total = 9): ModuleRow["plan"] {
	return { file: "src/a/plan.aide", status, done, total };
}

describe("buildChips", () => {
	it("is empty for a module holding no brief, plan, research or todo", () => {
		expect(buildChips({ module: makeModule() })).toEqual([]);
	});

	it("draws brief and research as plain keys with no value, brief first", () => {
		const chips = buildChips({ module: makeModule({ brief: "src/a/brief.aide", research: "src/a/research.aide" }) });
		expect(chips).toEqual([
			{ kind: "brief", tone: "", icon: "doc", key: "brief", value: null, file: "src/a/brief.aide" },
			{ kind: "research", tone: "", icon: "search", key: "research", value: null, file: "src/a/research.aide" },
		]);
	});

	it.each([
		["proposed", "warn", "gate"],
		["approved", "run", "run"],
		["completed", "done", "done"],
		["abandoned", "muted", "close"],
	] as const)("a %s plan reads `plan · %s` with its steps, tone %s and icon %s", (status, tone, icon) => {
		const [chip] = buildChips({ module: makeModule({ plan: planOf(status) }) });
		expect(chip).toEqual({ kind: "plan", tone, icon, key: `plan · ${status}`, value: "3/9", file: "src/a/plan.aide" });
	});

	it("draws a plan with no status as the muted todo-icon chip keyed just `plan`", () => {
		const [chip] = buildChips({ module: makeModule({ plan: planOf("unset", 0, 4) }) });
		expect(chip).toMatchObject({ tone: "muted", icon: "todo", key: "plan", value: "0/4" });
	});

	it("draws a todo with open items as danger with the issues glyph, and a closed one as done", () => {
		const open = buildChips({ module: makeModule({ todo: { file: "src/a/todo.aide", open: 2, total: 5 } }) })[0];
		expect(open).toMatchObject({ kind: "todo", tone: "danger", icon: "issues", key: "todo", value: "2 open of 5" });
		const closed = buildChips({ module: makeModule({ todo: { file: "src/a/todo.aide", open: 0, total: 5 } }) })[0];
		expect(closed).toMatchObject({ tone: "done", icon: "done", value: "0 open of 5" });
	});

	it("orders the chips brief, plan, research, todo", () => {
		const chips = buildChips({
			module: makeModule({
				brief: "b",
				plan: planOf("approved"),
				research: "r",
				todo: { file: "t", open: 1, total: 2 },
			}),
		});
		expect(chips.map((chip) => chip.kind)).toEqual(["brief", "plan", "research", "todo"]);
	});
});
