import { describe, expect, it } from "vitest";
import formatSpan from "./index.js";

describe("formatSpan", () => {
	it.each([
		[0, "0s"],
		[45, "45s"],
		[59, "59s"],
		[60, "1m 00s"],
		[65, "1m 05s"],
		[362, "6m 02s"],
		[475, "7m 55s"],
		[3599, "59m 59s"],
		[3600, "1h 00m"],
		[4320, "1h 12m"],
		[7500, "2h 05m"],
	])("formats %i seconds as %s", (seconds, expected) => {
		expect(formatSpan(seconds)).toBe(expected);
	});

	it("clamps negatives and floors fractions", () => {
		expect(formatSpan(-5)).toBe("0s");
		expect(formatSpan(61.9)).toBe("1m 01s");
	});
});
