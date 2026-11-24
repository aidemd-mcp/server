import { describe, expect, it } from "vitest";
import baseName from "./index.js";

describe("baseName", () => {
	it.each([
		["posix path", "src/observer/index.ts", "index.ts"],
		["windows path", "src\\observer\\index.ts", "index.ts"],
		["mixed separators", "src/observer\\index.ts", "index.ts"],
		["trailing separator", "src/observer/", "observer"],
		["bare name", "plan.aide", "plan.aide"],
	])("takes the last segment of a %s", (_name, path, expected) => {
		expect(baseName(path)).toBe(expected);
	});

	it.each(["", "/", "\\\\"])("returns the path itself when it has no segment (%j)", (path) => {
		expect(baseName(path)).toBe(path);
	});
});
