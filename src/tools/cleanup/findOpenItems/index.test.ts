import { describe, it, expect } from "vitest";
import findOpenItems from "./index.js";

describe("findOpenItems", () => {
	it.each([
		["dash", "- [ ] item"],
		["star", "* [ ] item"],
		["plus", "+ [ ] item"],
		["numbered dot", "1. [ ] item"],
		["numbered paren", "2) [ ] item"],
		["indented sub-item", "    - [ ] item"],
		["tab-indented sub-item", "\t* [ ] item"],
	])("detects an unchecked %s checkbox", (_name, line) => {
		expect(findOpenItems(line)).toEqual({
			total: 1,
			open: [{ line: 1, text: "item" }],
		});
	});

	it.each(["- [x] done", "- [X] done"])("counts %s as checked", (line) => {
		expect(findOpenItems(line)).toEqual({ total: 1, open: [] });
	});

	it.each([
		["### 2. [ ] Title", true],
		["### 2a. [x] Title", false],
		["## [ ] Title", true],
		["###### 10. [X] Title", false],
	])("detects heading checkbox %s", (line, isOpen) => {
		const result = findOpenItems(line);
		expect(result.total).toBe(1);
		expect(result.open).toEqual(isOpen ? [{ line: 1, text: "Title" }] : []);
	});

	it("gives correct 1-based line numbers for CRLF content", () => {
		const content = "# Plan\r\n\r\n- [x] one\r\n- [ ] two\r\n- [ ] three\r\n";
		expect(findOpenItems(content)).toEqual({
			total: 3,
			open: [
				{ line: 4, text: "two" },
				{ line: 5, text: "three" },
			],
		});
	});

	it("trims the item text", () => {
		expect(findOpenItems("- [ ]    padded text   ").open).toEqual([
			{ line: 1, text: "padded text" },
		]);
	});

	it("falls back to the whole line when the remainder is empty", () => {
		expect(findOpenItems("  - [ ]  ").open).toEqual([
			{ line: 1, text: "- [ ]" },
		]);
	});

	it.each(["- [-] skipped", "- [ x] odd", "- [] empty", "- [xx] double"])(
		"does not treat %s as a checkbox",
		(line) => {
			expect(findOpenItems(line)).toEqual({ total: 0, open: [] });
		},
	);

	it("returns zero for content with no checkboxes", () => {
		expect(findOpenItems("# Title\n\nJust prose.\n- plain bullet\n")).toEqual({
			total: 0,
			open: [],
		});
	});

	it("returns zero for empty content", () => {
		expect(findOpenItems("")).toEqual({ total: 0, open: [] });
	});

	it("counts checkboxes inside fenced code blocks", () => {
		const content = "```\n- [ ] quoted\n```\n";
		expect(findOpenItems(content)).toEqual({
			total: 1,
			open: [{ line: 2, text: "quoted" }],
		});
	});
});
