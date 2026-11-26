import { describe, expect, it } from "vitest";
import type { BoardUnavailable } from "@/service/observer/kanban/types/index.js";
import boardHints from "./index.js";

describe("boardHints", () => {
	it.each(Object.keys(boardHints) as BoardUnavailable["reason"][])("has a non-empty hint for %s", (reason) => {
		expect(boardHints[reason].trim().length).toBeGreaterThan(0);
	});

	it.each(["no-brain-config", "brain-config-unreadable", "no-kanban-field", "unsupported-source"] as const)(
		"%s names /aide:brain config or --kanban",
		(reason) => {
			expect(boardHints[reason]).toMatch(/\/aide:brain config|--kanban/);
		},
	);

	it("points the malformed-field hint at /aide:brain config", () => {
		expect(boardHints["kanban-field-malformed"]).toContain("/aide:brain config");
	});

	it("points the missing-folder hint at --kanban", () => {
		expect(boardHints["kanban-folder-missing"]).toContain("--kanban");
	});
});
