import { describe, it, expect } from "vitest";
import brainContract from "@/service/brainContract/index.js";
import parseBundledTemplate from "./index.js";

describe("parseBundledTemplate", () => {
	it("returns an ok parse of the bundled template", () => {
		expect(parseBundledTemplate().kind).toBe("ok");
	});

	it.each(brainContract.map((entry) => entry.field))(
		"carries a non-empty string for contract field %s",
		(field) => {
			const result = parseBundledTemplate();
			expect(typeof result[field]).toBe("string");
			expect(result[field].trim().length).toBeGreaterThan(0);
		},
	);
});
