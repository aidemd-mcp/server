import { describe, expect, it } from "vitest";
import type { ModuleRow } from "@/observer/page/types/index.js";
import pickAlignment from "./index.js";

function makeModule(overrides: Partial<ModuleRow> = {}): ModuleRow {
	return {
		folder: "src/a",
		label: "src/a",
		description: null,
		alignment: null,
		intentFile: "src/a/.aide",
		brief: null,
		plan: null,
		todo: null,
		research: null,
		malformed: [],
		...overrides,
	};
}

describe("pickAlignment", () => {
	it.each(["aligned", "unreviewed", "misaligned"] as const)("keeps a reported %s", (alignment) => {
		expect(pickAlignment({ module: makeModule({ alignment }) })).toBe(alignment);
	});

	it("shows a missing alignment on a readable intent spec as unreviewed, the spec's default", () => {
		expect(pickAlignment({ module: makeModule({ alignment: null }) })).toBe("unreviewed");
	});

	it("gives a module with no intent spec no badge", () => {
		expect(pickAlignment({ module: makeModule({ intentFile: null }) })).toBeNull();
	});

	it("gives a module whose intent spec could not be read no badge", () => {
		expect(pickAlignment({ module: makeModule({ malformed: ["src/a/.aide"] }) })).toBeNull();
	});
});
