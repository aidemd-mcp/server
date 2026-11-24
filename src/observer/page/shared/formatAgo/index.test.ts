import { describe, expect, it } from "vitest";
import formatAgo from "./index.js";

const now = new Date("2026-11-23T12:00:00.000Z");
const before = (seconds: number): string => new Date(now.getTime() - seconds * 1000).toISOString();

describe("formatAgo", () => {
	it.each([
		[4, "4s"],
		[59, "59s"],
		[60, "1m"],
		[14 * 60 + 30, "14m"],
		[3599, "59m"],
		[2 * 3600 + 5 * 60, "2h 05m"],
	])("formats %i seconds ago as %s", (seconds, expected) => {
		expect(formatAgo({ iso: before(seconds), now })).toBe(expected);
	});

	it("reads a future instant as 0s", () => {
		expect(formatAgo({ iso: before(-30), now })).toBe("0s");
	});
});
