import { describe, it, expect } from "vitest";
import parseMode from "./index.js";

describe("parseMode", () => {
	it.each([
		[["--mode", "global"], "global"],
		[["--mode", "local"], "local"],
		[["--mode=global"], "global"],
		[["--mode=local"], "local"],
		[["--brain", "obsidian", "--mode", "local"], "local"],
	])("parses %j as %s", (argv, expected) => {
		expect(parseMode(argv)).toBe(expected);
	});

	it("returns undefined when the flag is absent", () => {
		expect(parseMode([])).toBeUndefined();
		expect(parseMode(["--brain", "obsidian"])).toBeUndefined();
	});

	it.each([
		[["--mode"]],
		[["--mode", "--brain"]],
		[["--mode="]],
	])("throws a missing-value error for %j", (argv) => {
		expect(() => parseMode(argv)).toThrow("--mode requires a value: global or local.");
	});

	it.each([
		[["--mode=remote"], "remote"],
		[["--mode", "Global"], "Global"],
	])("throws an unknown-value error for %j", (argv, value) => {
		expect(() => parseMode(argv)).toThrow(
			`Unknown --mode value "${value}". Use global or local.`,
		);
	});
});
