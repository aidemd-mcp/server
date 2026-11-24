import { describe, it, expect } from "vitest";
import describeError from "./index.js";

describe("describeError", () => {
	it("returns the message of an Error", () => {
		expect(describeError({ error: new Error("boom") })).toBe("boom");
	});

	it("returns the message of an Error subclass", () => {
		expect(describeError({ error: new TypeError("bad type") })).toBe("bad type");
	});

	it.each([
		["a string", "plain text", "plain text"],
		["a number", 42, "42"],
		["null", null, "null"],
		["undefined", undefined, "undefined"],
	])("stringifies %s", (_label, error, expected) => {
		expect(describeError({ error })).toBe(expected);
	});
});
