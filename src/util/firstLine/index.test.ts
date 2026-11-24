import { describe, expect, it } from "vitest";
import firstLine from "./index.js";

describe("firstLine", () => {
	it.each([
		["single line", "Fix the bug", "Fix the bug"],
		["padded line", "  Fix the bug  ", "Fix the bug"],
		["leading blank lines", "\n\n  Fix the bug\nmore", "Fix the bug"],
		["CRLF with a blank line between", "a\r\n\r\nb", "a"],
		["trailing blank lines", "a\n\n  \n", "a"],
	])("returns the first non-blank line, trimmed, with no marker (%s)", (_name, text, expected) => {
		expect(firstLine({ text })).toBe(expected);
	});

	it.each([
		["only blank lines", "\n  \n\t"],
		["empty text", ""],
	])("returns an empty string for %s, with or without ellipsis", (_name, text) => {
		expect(firstLine({ text })).toBe("");
		expect(firstLine({ text, ellipsis: true })).toBe("");
	});

	describe("with ellipsis", () => {
		it.each([
			["more content follows", "first line\nsecond", "first line…"],
			["blank lines then more content", "a\r\n\r\nb", "a…"],
			["leading blank lines then more", "\n\n  Fix the bug\nmore", "Fix the bug…"],
			["a single line", "only", "only"],
			["only trailing blank lines", "only\n\n  \n", "only"],
		])("%s", (_name, text, expected) => {
			expect(firstLine({ text, ellipsis: true })).toBe(expected);
		});
	});
});
