import { describe, expect, it } from "vitest";
import parseBlocks from "./index.js";

describe("parseBlocks", () => {
	it("splits paragraphs on blank lines and joins their wrapped lines", () => {
		expect(parseBlocks("First line\nsecond line\n\nNext paragraph")).toEqual([
			{ type: "p", text: "First line second line" },
			{ type: "p", text: "Next paragraph" },
		]);
	});

	it("reads bullets and numbered items as separate lists", () => {
		expect(parseBlocks("- a\n- b\n\n1. one\n2) two")).toEqual([
			{ type: "ul", items: ["a", "b"] },
			{ type: "ol", items: ["one", "two"] },
		]);
	});

	it("starts a new list when the list kind changes without a blank line", () => {
		expect(parseBlocks("- a\n1. b")).toEqual([
			{ type: "ul", items: ["a"] },
			{ type: "ol", items: ["b"] },
		]);
	});

	it("continues a list item on an indented line and ends the list on an unindented one", () => {
		expect(parseBlocks("- a\n  more of a\nplain")).toEqual([
			{ type: "ul", items: ["a more of a"] },
			{ type: "p", text: "plain" },
		]);
	});

	it("accepts CRLF input and returns nothing for blank input", () => {
		expect(parseBlocks("a\r\n\r\nb")).toEqual([
			{ type: "p", text: "a" },
			{ type: "p", text: "b" },
		]);
		expect(parseBlocks("  \n\n")).toEqual([]);
	});

	it("leaves headings and HTML as paragraph text", () => {
		expect(parseBlocks("# Title\n\n<script>x</script>")).toEqual([
			{ type: "p", text: "# Title" },
			{ type: "p", text: "<script>x</script>" },
		]);
	});
});
