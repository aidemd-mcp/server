import { describe, expect, it } from "vitest";
import percentOf from "./index.js";

describe("percentOf", () => {
	it.each([
		[0, 9, 0],
		[3, 9, 33],
		[2, 3, 67],
		[9, 9, 100],
	])("is %i of %i as %i percent, rounded to a whole number", (part, total, percent) => {
		expect(percentOf({ part, total })).toBe(percent);
	});

	it("is 0 for an empty total", () => {
		expect(percentOf({ part: 0, total: 0 })).toBe(0);
		expect(percentOf({ part: 3, total: 0 })).toBe(0);
	});
});
