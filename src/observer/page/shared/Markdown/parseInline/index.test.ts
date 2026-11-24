import { describe, expect, it } from "vitest";
import parseInline from "./index.js";

describe("parseInline", () => {
	it("returns plain text as one node", () => {
		expect(parseInline("just words")).toEqual([{ type: "text", text: "just words" }]);
	});

	it("splits bold and code runs from the text around them", () => {
		expect(parseInline("Run **now** with `aide init` today")).toEqual([
			{ type: "text", text: "Run " },
			{ type: "bold", text: "now" },
			{ type: "text", text: " with " },
			{ type: "code", text: "aide init" },
			{ type: "text", text: " today" },
		]);
	});

	it("keeps an unclosed marker as plain text", () => {
		expect(parseInline("a **b and `c")).toEqual([{ type: "text", text: "a **b and `c" }]);
	});

	it("returns nothing for an empty line", () => {
		expect(parseInline("")).toEqual([]);
	});
});
