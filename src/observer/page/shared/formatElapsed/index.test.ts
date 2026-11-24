import { describe, expect, it } from "vitest";
import formatElapsed from "./index.js";

describe("formatElapsed", () => {
	it.each([
		[0, "0s"],
		[59, "59s"],
		[252, "4m 12s"],
		[3599, "59m 59s"],
		[3780, "1h 03m"],
		[7500, "2h 05m"],
	])("formats %i seconds as %s", (seconds, expected) => {
		expect(formatElapsed(seconds)).toBe(expected);
	});

	it("clamps negatives and floors fractions", () => {
		expect(formatElapsed(-5)).toBe("0s");
		expect(formatElapsed(61.9)).toBe("1m 01s");
	});
});
