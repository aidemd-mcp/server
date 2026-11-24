import { describe, expect, it } from "vitest";
import formatRunningFor from "./index.js";

describe("formatRunningFor", () => {
	it("adds the time since the status was built to its elapsed time", () => {
		expect(formatRunningFor({ elapsedMs: 252_000, asOf: "2026-01-01T09:59:50.000Z", now: new Date("2026-01-01T10:00:00.000Z") })).toBe("4m 22s");
	});

	it("never counts backwards when the clock is behind the status", () => {
		expect(formatRunningFor({ elapsedMs: 45_000, asOf: "2026-01-01T10:00:10.000Z", now: new Date("2026-01-01T10:00:00.000Z") })).toBe("45s");
	});
});
