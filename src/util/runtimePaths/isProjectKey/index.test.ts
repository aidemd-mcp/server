import { describe, it, expect } from "vitest";
import isProjectKey from "./index.js";

describe("isProjectKey", () => {
	it.each([
		["a plain key", "aidemd-mcp-3f9a2c"],
		["a name with spaces", "my project-3f9a2c"],
		["a 255-character key", `${"a".repeat(248)}-3f9a2c`],
	])("accepts %s", (_label, value) => {
		expect(isProjectKey(value)).toBe(true);
	});

	it.each([
		["empty", ""],
		["dot-dot", ".."],
		["dot", "."],
		["a forward slash", "a/b-3f9a2c"],
		["a backslash", "a\\b-3f9a2c"],
		["uppercase hex", "x-3F9A2C"],
		["a short hash", "x-3f9a2"],
		["a long hash", "x-3f9a2cd"],
		["no hash", "aidemd-mcp"],
		["a leading dot", ".hidden-3f9a2c"],
		["a NUL", "x\0y-3f9a2c"],
		["over 255 characters", `${"a".repeat(249)}-3f9a2c`],
	])("refuses a value with %s", (_label, value) => {
		expect(isProjectKey(value)).toBe(false);
	});
});
