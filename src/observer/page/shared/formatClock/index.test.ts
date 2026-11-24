import { describe, expect, it } from "vitest";
import formatClock from "./index.js";

// 2026-11-23 is a Monday.
const now = new Date(2026, 10, 23, 14, 30, 0);
const local = (day: number, hour: number, minute: number): string => new Date(2026, 10, day, hour, minute).toISOString();

describe("formatClock", () => {
	it("reads an instant from today as Today with a padded clock", () => {
		expect(formatClock({ iso: local(23, 9, 12), now })).toEqual({
			clock: "09:12",
			day: "Today",
			start: "Today 09:12",
		});
	});

	it("reads the previous calendar day as Yesterday, even a few minutes ago", () => {
		const justAfterMidnight = new Date(2026, 10, 23, 0, 10);
		expect(formatClock({ iso: local(22, 23, 55), now: justAfterMidnight }).day).toBe("Yesterday");
	});

	it("reads 2 to 6 days ago as the weekday", () => {
		expect(formatClock({ iso: local(21, 16, 2), now })).toEqual({
			clock: "16:02",
			day: "Sat",
			start: "Sat 16:02",
		});
		expect(formatClock({ iso: local(17, 8, 0), now }).day).toBe("Tue");
	});

	it("reads a week or more ago as Mon D", () => {
		expect(formatClock({ iso: local(16, 16, 2), now })).toEqual({
			clock: "16:02",
			day: "Nov 16",
			start: "Nov 16 16:02",
		});
	});
});
