import { describe, expect, it } from "vitest";
import boardHints from "../boardHints/index.js";
import boardUnavailable from "./index.js";

describe("boardUnavailable", () => {
	it.each(["no-brain-config", "no-kanban-tag", "board-read-failed", "kanban-folder-missing"] as const)(
		"attaches the table's hint for %s",
		(reason) => {
			expect(boardUnavailable({ reason, detail: "d" })).toEqual({
				state: "unavailable",
				reason,
				detail: "d",
				hint: boardHints[reason],
			});
		},
	);

	it("keeps the detail verbatim", () => {
		const detail = "C:\\some path\\with `odd` text: 100%";
		expect(boardUnavailable({ reason: "board-folder-missing", detail }).detail).toBe(detail);
	});
});
