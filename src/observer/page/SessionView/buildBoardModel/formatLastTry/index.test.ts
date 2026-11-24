import { describe, expect, it } from "vitest";
import formatLastTry from "./index.js";

describe("formatLastTry", () => {
	it("writes the local clock time with seconds, zero-padded", () => {
		expect(formatLastTry({ iso: new Date(2026, 10, 23, 14, 31, 2).toISOString() })).toBe("14:31:02");
		expect(formatLastTry({ iso: new Date(2026, 10, 23, 9, 5, 7).toISOString() })).toBe("09:05:07");
	});
});
