import { describe, expect, it } from "vitest";
import measureIndent from "./index.js";

describe("measureIndent", () => {
	it.each([
		["text", 0],
		["  text", 2],
		["\ttext", 4],
		["  \ttext", 4],
		["     \ttext", 8],
		["   ", 3],
		["", 0],
	])("measures %j as %i columns", (line, columns) => {
		expect(measureIndent(line)).toBe(columns);
	});
});
