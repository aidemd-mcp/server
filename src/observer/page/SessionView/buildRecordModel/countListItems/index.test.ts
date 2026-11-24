import { describe, expect, it } from "vitest";
import countListItems from "./index.js";

describe("countListItems", () => {
	it("counts bulleted and numbered lines, indented ones included", () => {
		expect(countListItems("- a\n- b\n1. c\n  2. d")).toBe(4);
	});

	it("ignores prose, empty bullets and an empty string", () => {
		expect(countListItems("Just prose.\n-\n- \n")).toBe(0);
		expect(countListItems("")).toBe(0);
	});
});
