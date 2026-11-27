import { describe, expect, it } from "vitest";
import { z } from "zod";
import isIsoDateTime from "@/service/observer/event/shared/isIsoDateTime/index.js";

const reference = z.string().datetime();

const cases = [
	"2026-11-25T10:00:00Z",
	"2026-11-25T10:00:00.123Z",
	"2026-11-25T10:00:00.123456Z",
	"2026-11-25T10:00:00.1Z",
	"2026-11-25T10:00Z",
	"2026-11-25T10:00:00+01:00",
	"2026-11-25T10:00:00z",
	"2026-11-25T10:00:00",
	"2026-11-25 10:00:00Z",
	"2024-02-29T00:00:00Z",
	"2025-02-29T00:00:00Z",
	"1900-02-29T00:00:00Z",
	"2000-02-29T00:00:00Z",
	"2026-13-01T00:00:00Z",
	"2026-00-10T00:00:00Z",
	"2026-04-31T00:00:00Z",
	"2026-01-31T00:00:00Z",
	"2026-11-25T24:00:00Z",
	"2026-11-25T23:60:00Z",
	"2026-11-25T23:59:60Z",
	"2026-11-25",
	"",
	" 2026-11-25T10:00:00Z",
	"2026-11-25T10:00:00Z ",
	"2026-11-25T10:00:00Z\n",
	"2026-11-25T10:00:00.Z",
];

describe("isIsoDateTime", () => {
	it.each(cases)("gives zod's verdict for %j", (value) => {
		expect(isIsoDateTime(value)).toBe(reference.safeParse(value).success);
	});

	it("accepts a plain UTC timestamp and rejects an offset one", () => {
		expect(isIsoDateTime("2026-11-25T10:00:00.000Z")).toBe(true);
		expect(isIsoDateTime("2026-11-25T10:00:00+01:00")).toBe(false);
	});
});
