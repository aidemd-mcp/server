import { describe, expect, it } from "vitest";
import compareNewest from "./index.js";

describe("compareNewest", () => {
	it("sorts later instants first and keeps equal ones in place", () => {
		const sorted = ["2026-01-01T09:00:00.000Z", "2026-01-01T10:00:00.000Z", "2026-01-01T09:00:00.000Z"].sort(compareNewest);
		expect(sorted).toEqual(["2026-01-01T10:00:00.000Z", "2026-01-01T09:00:00.000Z", "2026-01-01T09:00:00.000Z"]);
		expect(compareNewest("a", "a")).toBe(0);
	});
});
