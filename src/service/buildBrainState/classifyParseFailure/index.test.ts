import { describe, expect, it } from "vitest";
import type { BrainSectionMarker } from "@/types/index.js";
import classifyParseFailure from "./index.js";

describe("classifyParseFailure", () => {
	it("maps missing to null", () => {
		expect(classifyParseFailure({ kind: "missing" })).toBeNull();
	});

	it("passes the missing-sections array through unchanged", () => {
		const sections = ["kanban-board", "work-kanban"] as unknown as BrainSectionMarker[];
		const fault = classifyParseFailure({ kind: "missing-sections", sections });
		expect(fault).toEqual({ kind: "missing-sections", sections });
		expect(fault && fault.kind === "missing-sections" && fault.sections).toBe(sections);
	});

	it("maps malformed-frontmatter to malformed with the reason verbatim", () => {
		const reason = "frontmatter: field `name` must be a non-empty string";
		expect(classifyParseFailure({ kind: "malformed-frontmatter", reason })).toEqual({
			kind: "malformed",
			reason,
		});
	});

	it("maps malformed-body to malformed with the reason verbatim", () => {
		const reason = "marker <!-- x:start --> has no closing marker";
		expect(classifyParseFailure({ kind: "malformed-body", reason })).toEqual({
			kind: "malformed",
			reason,
		});
	});
});
