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
});
