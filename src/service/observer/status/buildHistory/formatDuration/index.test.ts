import { describe, it, expect } from "vitest";
import formatDuration from "./index.js";

describe("formatDuration", () => {
	it.each([
		[0, "0s"],
		[45_000, "45s"],
		[252_000, "4m 12s"],
		[3_780_000, "1h 3m"],
		[-5, "0s"],
		[999, "0s"],
		[59_999, "59s"],
		[60_000, "1m 0s"],
	])("formats %i ms as %s", (ms, expected) => {
		expect(formatDuration(ms)).toBe(expected);
	});
});
