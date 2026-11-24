import { describe, it, expect } from "vitest";
import isSessionId from "./index.js";

describe("isSessionId", () => {
	it("accepts a uuid", () => {
		expect(isSessionId("3f2b8c1e-4d5a-4e6f-9a7b-1c2d3e4f5a6b")).toBe(true);
	});

	it.each([
		["empty", ""],
		["dot", "."],
		["dot-dot", ".."],
		["parent traversal", "../x"],
		["forward slash", "a/b"],
		["backslash", "a\\b"],
		["leading dot", ".hidden"],
		["129 characters", "a".repeat(129)],
	])("refuses a value that is %s", (_label, value) => {
		expect(isSessionId(value)).toBe(false);
	});
});
