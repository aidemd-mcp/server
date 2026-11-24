import { describe, expect, it } from "vitest";
import formatLastActivity from "./index.js";

const now = new Date("2026-11-23T12:00:00.000Z");
const before = (seconds: number): string => new Date(now.getTime() - seconds * 1000).toISOString();
const DAY = 86_400;

describe("formatLastActivity", () => {
	it.each([
		[0, "now"],
		[59, "now"],
		[60, "1m ago"],
		[2 * 60 + 30, "2m ago"],
		[59 * 60 + 59, "59m ago"],
		[3600, "1h ago"],
		[3 * 3600 + 20 * 60, "3h ago"],
		[23 * 3600 + 59 * 60, "23h ago"],
		[DAY, "yesterday"],
		[2 * DAY - 1, "yesterday"],
		[2 * DAY, "2 days ago"],
		[4 * DAY + 3600, "4 days ago"],
		[6 * DAY + 23 * 3600, "6 days ago"],
		[7 * DAY, "1 week ago"],
		[13 * DAY, "1 week ago"],
		[14 * DAY, "2 weeks ago"],
		[30 * DAY, "4 weeks ago"],
	])("formats %i seconds ago as %s", (seconds, expected) => {
		expect(formatLastActivity({ iso: before(seconds), now })).toBe(expected);
	});

	it("reads a future instant as now", () => {
		expect(formatLastActivity({ iso: before(-120), now })).toBe("now");
	});
});
