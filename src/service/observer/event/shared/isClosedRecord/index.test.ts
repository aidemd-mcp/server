import { describe, expect, it } from "vitest";
import isClosedRecord from "@/service/observer/event/shared/isClosedRecord/index.js";

const keys = ["a", "b"] as const;

describe("isClosedRecord", () => {
	it.each([
		["null", null],
		["an array", []],
		["a number", 1],
		["a string", "a"],
		["undefined", undefined],
	])("rejects %s", (_name, value) => {
		expect(isClosedRecord(value, keys)).toBe(false);
	});

	it("accepts an object with only allowed keys", () => {
		expect(isClosedRecord({ a: 1, b: "x" }, keys)).toBe(true);
		expect(isClosedRecord({ a: 1 }, keys)).toBe(true);
	});

	it("accepts an empty object", () => {
		expect(isClosedRecord({}, keys)).toBe(true);
	});

	it("rejects one extra key", () => {
		expect(isClosedRecord({ a: 1, c: 2 }, keys)).toBe(false);
	});

	it("rejects a __proto__ key that JSON.parse produced", () => {
		const value: unknown = JSON.parse('{"a":1,"__proto__":{"b":2}}');
		expect(isClosedRecord(value, keys)).toBe(false);
	});
});
