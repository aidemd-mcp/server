import { describe, expect, it } from "vitest";
import type { BoardColumn, BoardTask } from "@/types/index.js";
import buildColumn from "./index.js";

function task(slug: string, overrides: Partial<Extract<BoardTask, { state: "readable" }>> = {}): BoardTask {
	return { state: "readable", slug, column: "todo", title: slug, priority: "p2", tags: [], inSession: false, ...overrides };
}

function column(id: BoardColumn["id"], label: BoardColumn["label"], tasks: BoardTask[]): BoardColumn {
	return { id, label, tasks };
}

const NO_LINKS: ReadonlySet<string> = new Set();

describe("buildColumn", () => {
	it("names the column by its label and counts every task", () => {
		const model = buildColumn({ column: column("todo", "Todo", [task("a"), task("b")]), linkedSlugs: NO_LINKS });
		expect(model.id).toBe("todo");
		expect(model.name).toBe("Todo");
		expect(model.total).toBe(2);
		expect(model.tasks.map((card) => card.slug)).toEqual(["a", "b"]);
	});

	it("keeps the observer's order outside Done", () => {
		const model = buildColumn({ column: column("backlog", "Backlog", [task("z"), task("a")]), linkedSlugs: NO_LINKS });
		expect(model.tasks.map((card) => card.slug)).toEqual(["z", "a"]);
	});

	it("orders Done newest `updated` first", () => {
		const done = column("done", "Done", [task("old", { updated: "2026-11-01" }), task("new", { updated: "2026-11-20" }), task("undated")]);
		expect(buildColumn({ column: done, linkedSlugs: NO_LINKS }).tasks.map((card) => card.slug)).toEqual(["new", "old", "undated"]);
	});

	it("does not reorder the column it was given", () => {
		const tasks = [task("old", { updated: "2026-11-01" }), task("new", { updated: "2026-11-20" })];
		buildColumn({ column: column("done", "Done", tasks), linkedSlugs: NO_LINKS });
		expect(tasks.map((entry) => entry.slug)).toEqual(["old", "new"]);
	});

	it("caps Done at 5 and every other column at 8", () => {
		expect(buildColumn({ column: column("done", "Done", []), linkedSlugs: NO_LINKS }).cap).toBe(5);
		for (const [id, label] of [
			["backlog", "Backlog"],
			["todo", "Todo"],
			["in-progress", "In Progress"],
			["in-review", "In Review"],
		] as const) {
			expect(buildColumn({ column: column(id, label, []), linkedSlugs: NO_LINKS }).cap).toBe(8);
		}
	});

	it("links a task the record names or the focused session touched, and no other", () => {
		const model = buildColumn({
			column: column("in-progress", "In Progress", [task("recorded", { inSession: true }), task("touched"), task("other")]),
			linkedSlugs: new Set(["touched"]),
		});
		expect(model.tasks.map((card) => [card.slug, card.linked])).toEqual([
			["recorded", true],
			["touched", true],
			["other", false],
		]);
	});
});
