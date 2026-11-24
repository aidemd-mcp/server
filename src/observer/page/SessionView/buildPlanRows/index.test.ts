import { describe, expect, it } from "vitest";
import type { ModuleRow } from "@/observer/page/types/index.js";
import buildPlanRows from "./index.js";

function makeModule({ folder, overrides = {} }: { folder: string; overrides?: Partial<ModuleRow> }): ModuleRow {
	return {
		folder,
		label: folder === "." ? ".aide/intent.aide" : folder,
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

function planOf(status: NonNullable<ModuleRow["plan"]>["status"], done: number, total: number): ModuleRow["plan"] {
	return { file: "plan.aide", status, done, total };
}

describe("buildPlanRows", () => {
	it("is empty when no module holds a plan or todo", () => {
		expect(buildPlanRows({ modules: [makeModule({ folder: "." })], current: null })).toEqual([]);
	});

	it.each([
		["proposed", "Proposed", "warn", "gate"],
		["approved", "Approved", "run", "run"],
		["completed", "Completed", "done", "done"],
		["abandoned", "Abandoned", "outline", "close"],
		["unset", "No status", "outline", "todo"],
	] as const)("a %s plan reads %s with the %s badge and %s glyph", (status, word, tone, icon) => {
		const [row] = buildPlanRows({ modules: [makeModule({ folder: "src/a", overrides: { plan: planOf(status, 3, 9) } })], current: null });
		expect(row).toMatchObject({ module: "src/a", kind: "plan", status: word, tone, icon, progress: "3/9 steps", percent: 33 });
	});

	it("reports a todo with open items as `<n> open` in danger, progress counting what is closed", () => {
		const [row] = buildPlanRows({ modules: [makeModule({ folder: "src/a", overrides: { todo: { file: "todo.aide", open: 2, total: 5 } } })], current: null });
		expect(row).toMatchObject({ kind: "todo", status: "2 open", tone: "danger", icon: "issues", progress: "3/5 closed", percent: 60 });
	});

	it("reports an all-closed todo as `All closed` in done", () => {
		const [row] = buildPlanRows({ modules: [makeModule({ folder: "src/a", overrides: { todo: { file: "todo.aide", open: 0, total: 4 } } })], current: null });
		expect(row).toMatchObject({ status: "All closed", tone: "done", icon: "done", progress: "4/4 closed", percent: 100 });
	});

	it("gives an empty plan a 0 bar rather than a division by zero", () => {
		const [row] = buildPlanRows({ modules: [makeModule({ folder: "a", overrides: { plan: planOf("proposed", 0, 0) } })], current: null });
		expect(row?.percent).toBe(0);
	});

	it("opens each row's own file: the plan, or the todo", () => {
		const rows = buildPlanRows({
			modules: [
				makeModule({
					folder: "src/a",
					overrides: { plan: { file: "src/a/plan.aide", status: "approved", done: 1, total: 2 }, todo: { file: "src/a/todo.aide", open: 1, total: 2 } },
				}),
			],
			current: null,
		});
		expect(rows.map((row) => row.item)).toEqual([
			{ kind: "file", path: "src/a/plan.aide" },
			{ kind: "file", path: "src/a/todo.aide" },
		]);
	});

	it("lists modules in the order given, a module's plan before its todo, and highlights only the current module's rows", () => {
		const rows = buildPlanRows({
			modules: [
				makeModule({ folder: ".", overrides: { plan: planOf("completed", 2, 2) } }),
				makeModule({ folder: "src/a", overrides: { plan: planOf("approved", 1, 4), todo: { file: "todo.aide", open: 1, total: 3 } } }),
				makeModule({ folder: "src/b", overrides: { todo: { file: "todo.aide", open: 0, total: 1 } } }),
			],
			current: "src/a",
		});
		expect(rows.map((row) => [row.module, row.kind, row.highlighted])).toEqual([
			[".aide/intent.aide", "plan", false],
			["src/a", "plan", true],
			["src/a", "todo", true],
			["src/b", "todo", false],
		]);
	});
});
