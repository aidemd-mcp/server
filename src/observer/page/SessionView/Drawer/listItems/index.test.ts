import { describe, expect, it } from "vitest";
import listItems from "./index.js";

describe("listItems", () => {
	it("takes bullets and numbers as items", () => {
		expect(listItems("- one\n- two\n\n1. three")).toEqual(["one", "two", "three"]);
	});

	it("takes a paragraph as one item", () => {
		expect(listItems("Round 1 missed\nties.")).toEqual(["Round 1 missed ties."]);
	});

	it("is empty for blank text", () => {
		expect(listItems("  \n")).toEqual([]);
	});

	it("reads each table body row as one item, its cells joined", () => {
		expect(listItems("| a | b |\n|---|---|\n| 1 | 2 |\n| 3 | 4 |")).toEqual(["1 · 2", "3 · 4"]);
	});
});
