import { describe, expect, it } from "vitest";
import type { ModuleRow } from "@/observer/page/types/index.js";
import buildTodoRow from "./index.js";

type Todo = NonNullable<ModuleRow["todo"]>;

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

const todo = (overrides: Partial<Todo> = {}): Todo => ({ file: "src/tools/score/todo.aide", open: 2, total: 5, ...overrides });

describe("buildTodoRow", () => {
	it("words open issues in the danger tone, with progress counting what is closed", () => {
		expect(buildTodoRow({ module, todo: todo(), current: null })).toEqual({
			module: "src/tools/score",
			kind: "todo",
			status: "2 open",
			tone: "danger",
			icon: "issues",
			progress: "3/5 closed",
			percent: 60,
			highlighted: false,
			item: { kind: "file", path: "src/tools/score/todo.aide" },
		});
	});

	it("reads a list with nothing open as `All closed`", () => {
		expect(buildTodoRow({ module, todo: todo({ open: 0 }), current: null })).toMatchObject({
			status: "All closed",
			tone: "done",
			icon: "done",
			progress: "5/5 closed",
			percent: 100,
		});
	});

	it("highlights the current module's row only", () => {
		expect(buildTodoRow({ module, todo: todo(), current: "src/tools/score" }).highlighted).toBe(true);
		expect(buildTodoRow({ module, todo: todo(), current: null }).highlighted).toBe(false);
	});
});
