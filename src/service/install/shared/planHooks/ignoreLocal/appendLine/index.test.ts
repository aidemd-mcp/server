import { describe, it, expect } from "vitest";
import appendLine from "./index.js";

describe("appendLine", () => {
	it("returns just the line for absent text", () => {
		expect(appendLine({ text: null, line: "x" })).toBe("x\n");
	});

	it("returns just the line for empty text", () => {
		expect(appendLine({ text: "", line: "x" })).toBe("x\n");
	});

	it("appends after a trailing LF without adding a blank line", () => {
		expect(appendLine({ text: "a\nb\n", line: "x" })).toBe("a\nb\nx\n");
	});

	it("adds the missing newline before the line when the file does not end in one", () => {
		expect(appendLine({ text: "a\nb", line: "x" })).toBe("a\nb\nx\n");
	});

	it("uses CRLF when the file does, with a trailing newline", () => {
		expect(appendLine({ text: "a\r\nb\r\n", line: "x" })).toBe("a\r\nb\r\nx\r\n");
	});

	it("uses CRLF when the file does, without a trailing newline", () => {
		expect(appendLine({ text: "a\r\nb", line: "x" })).toBe("a\r\nb\r\nx\r\n");
	});
});
