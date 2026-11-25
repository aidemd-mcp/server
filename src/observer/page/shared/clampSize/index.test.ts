import { describe, expect, it } from "vitest";
import clampSize from "./index.js";

describe("clampSize", () => {
	it("keeps a size between its bounds, rounded", () => {
		expect(clampSize({ value: 500.4, min: 360, max: 900 })).toBe(500);
		expect(clampSize({ value: 100, min: 360, max: 900 })).toBe(360);
		expect(clampSize({ value: 2000, min: 360, max: 900 })).toBe(900);
	});

	it("lets the minimum win when the bounds cross", () => {
		expect(clampSize({ value: 500, min: 360, max: 200 })).toBe(360);
	});
});
