import { describe, expect, it } from "vitest";
import pickDay from "./index.js";

// 2026-11-23 is a Monday; each case is the day `daysAgo` before it.
const at = (day: number): Date => new Date(2026, 10, day, 12, 0);

describe("pickDay", () => {
	it.each([
		[0, 23, "Today"],
		[1, 22, "Yesterday"],
		[2, 21, "Sat"],
		[3, 20, "Fri"],
		[4, 19, "Thu"],
		[5, 18, "Wed"],
		[6, 17, "Tue"],
		[7, 16, "Nov 16"],
		[30, 1, "Nov 1"],
	])("names %i days ago (Nov %i) as %s", (daysAgo, day, expected) => {
		expect(pickDay({ at: at(day), daysAgo })).toBe(expected);
	});

	it("names Sunday and Monday from the weekday table", () => {
		expect(pickDay({ at: at(22), daysAgo: 2 })).toBe("Sun");
		expect(pickDay({ at: at(16), daysAgo: 3 })).toBe("Mon");
	});
});
