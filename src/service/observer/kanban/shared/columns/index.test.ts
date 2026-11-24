import { describe, it, expect } from "vitest";
import BOARD_COLUMNS from "./index.js";

describe("BOARD_COLUMNS", () => {
	it("lists the five board columns, in order, with ids and labels", () => {
		expect(BOARD_COLUMNS).toEqual([
			{ id: "backlog", label: "Backlog" },
			{ id: "todo", label: "Todo" },
			{ id: "in-progress", label: "In Progress" },
			{ id: "in-review", label: "In Review" },
			{ id: "done", label: "Done" },
		]);
	});

	it("does not include archive", () => {
		expect(BOARD_COLUMNS.map((column) => column.id)).not.toContain("archive");
	});
});
