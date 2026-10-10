import { describe, it, expect } from "vitest";
import toLineEnding from "./index.js";

describe("toLineEnding", () => {
	it("converts every LF to CRLF for a CRLF target", () => {
		expect(toLineEnding({ text: "a\nb\n\nc\n", eol: "\r\n" })).toBe("a\r\nb\r\n\r\nc\r\n");
	});

	it("is the identity for an LF target", () => {
		const text = "a\nb\n\nc\n";
		expect(toLineEnding({ text, eol: "\n" })).toBe(text);
	});

	it("leaves text without line breaks untouched", () => {
		expect(toLineEnding({ text: "abc", eol: "\r\n" })).toBe("abc");
	});

	it("produces no bare LF for a CRLF target", () => {
		expect(toLineEnding({ text: "x\ny\nz", eol: "\r\n" }).replace(/\r\n/g, "")).not.toContain("\n");
	});
});
