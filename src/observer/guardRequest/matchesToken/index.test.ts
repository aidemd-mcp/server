import { describe, it, expect } from "vitest";
import matchesToken from "./index.js";

describe("matchesToken", () => {
	it("matches identical strings", () => {
		expect(matchesToken({ given: "abc123", expected: "abc123" })).toBe(true);
	});

	it("rejects a same-length different string", () => {
		expect(matchesToken({ given: "abc124", expected: "abc123" })).toBe(false);
	});

	it("rejects strings of different length without throwing", () => {
		expect(matchesToken({ given: "abc", expected: "abc123" })).toBe(false);
		expect(matchesToken({ given: "abc1234", expected: "abc123" })).toBe(false);
	});
});
