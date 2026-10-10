import { describe, it, expect } from "vitest";
import detectLineEnding from "./index.js";

describe("detectLineEnding", () => {
	it("returns CRLF for a CRLF file", () => {
		expect(detectLineEnding("a\r\nb\r\nc")).toBe("\r\n");
	});

	it("returns LF for an LF file", () => {
		expect(detectLineEnding("a\nb\nc")).toBe("\n");
	});

	it("returns LF when there is no line break", () => {
		expect(detectLineEnding("no breaks here")).toBe("\n");
	});

	it("returns LF for empty text", () => {
		expect(detectLineEnding("")).toBe("\n");
	});

	it("decides by the first line break only", () => {
		expect(detectLineEnding("a\r\nb\nc\n")).toBe("\r\n");
		expect(detectLineEnding("a\nb\r\nc\r\n")).toBe("\n");
	});

	it("treats a leading bare LF as LF", () => {
		expect(detectLineEnding("\nabc\r\n")).toBe("\n");
	});
});
