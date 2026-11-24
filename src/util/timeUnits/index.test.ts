import { describe, expect, it } from "vitest";
import {
	DAY_MS,
	HOUR_MS,
	MINUTES_PER_DAY,
	MINUTE_MS,
	SECONDS_PER_DAY,
	SECONDS_PER_HOUR,
	SECONDS_PER_MINUTE,
	SECOND_MS,
} from "./index.js";

describe("timeUnits", () => {
	it("holds the calendar's seconds and minutes", () => {
		expect(SECONDS_PER_MINUTE).toBe(60);
		expect(SECONDS_PER_HOUR).toBe(3600);
		expect(SECONDS_PER_DAY).toBe(86_400);
		expect(MINUTES_PER_DAY).toBe(1440);
	});

	it("holds the calendar's milliseconds", () => {
		expect(SECOND_MS).toBe(1000);
		expect(MINUTE_MS).toBe(60_000);
		expect(HOUR_MS).toBe(3_600_000);
		expect(DAY_MS).toBe(86_400_000);
	});
});
