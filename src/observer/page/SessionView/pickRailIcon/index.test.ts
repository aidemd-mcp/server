import { describe, expect, it } from "vitest";
import type { RailCellState } from "@/observer/page/types/index.js";
import pickRailIcon from "./index.js";

describe("pickRailIcon", () => {
	it.each<[RailCellState, string]>([
		["done", "done"],
		["run", "run"],
		["wait", "wait"],
		["fail", "issues"],
		["todo", "todo"],
	])("draws %s as the %s glyph", (state, icon) => {
		expect(pickRailIcon({ state })).toBe(icon);
	});
});
