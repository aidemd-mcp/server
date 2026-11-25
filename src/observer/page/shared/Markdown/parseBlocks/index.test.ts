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

	it("reads # lines as headings with their level, ending any open paragraph or list", () => {
		expect(parseBlocks("intro\n## Section\n- a\n### Deeper ###x\ntext")).toEqual([
			{ type: "p", text: "intro" },
			{ type: "h", level: 2, text: "Section" },
			{ type: "ul", items: ["a"] },
			{ type: "h", level: 3, text: "Deeper ###x" },
			{ type: "p", text: "text" },
		]);
	});

	it("does not read a # with no space after it as a heading", () => {
		expect(parseBlocks("#hashtag")).toEqual([{ type: "p", text: "#hashtag" }]);
	});

	it("keeps a fenced code block's lines exactly, blank lines and markdown included", () => {
		expect(parseBlocks("before\n```ts\nconst a = 1;\n\n- not a list\n# not a heading\n```\nafter")).toEqual([
			{ type: "p", text: "before" },
			{ type: "code", text: "const a = 1;\n\n- not a list\n# not a heading" },
			{ type: "p", text: "after" },
		]);
	});

	it("ends an open list at a fence, and closes a fence the text never closes at the end", () => {
		expect(parseBlocks("- a\n```\nunclosed")).toEqual([
			{ type: "ul", items: ["a"] },
			{ type: "code", text: "unclosed" },
		]);
	});

	it("keeps checkbox markers in the item text for the renderer to draw", () => {
		expect(parseBlocks("- [ ] open\n- [x] done")).toEqual([{ type: "ul", items: ["[ ] open", "[x] done"] }]);
	});

	it("leaves HTML as paragraph text", () => {
		expect(parseBlocks("<script>x</script>")).toEqual([{ type: "p", text: "<script>x</script>" }]);
	});
});
