import { describe, expect, it } from "vitest";
import collectItemBody from "./index.js";

const collect = (text: string, markerIndent = 0, contentIndent = 2) =>
	collectItemBody({ lines: text.split("\n"), start: 1, markerIndent, contentIndent });

describe("collectItemBody", () => {
	it("takes the lines indented past the marker, dedented to the content column, and stops at the first that is not", () => {
		expect(collect("- a\n  - b\n    - c\n  d\n- e")).toEqual({ body: ["- b", "  - c", "d"], end: 4 });
	});

	it("takes a blank line only when the next non-blank line is indented under the item", () => {
		expect(collect("- a\n\n\n  b\n\nnext")).toEqual({ body: ["", "", "b"], end: 4 });
		expect(collect("- a\n\n- b")).toEqual({ body: [], end: 1 });
		expect(collect("- a\n\n")).toEqual({ body: [], end: 1 });
	});

	it("takes a fenced block whole, its blank and unindented lines included", () => {
		expect(collect("- a\n  ```\nraw\n\n  ```\nafter")).toEqual({ body: ["```", "raw", "", "```"], end: 5 });
	});

	it("never removes more than the content column, keeping deeper indentation", () => {
		expect(collect("1. a\n      code-ish", 0, 3)).toEqual({ body: ["   code-ish"], end: 2 });
	});

	it("measures against the marker's own indent for a nested item", () => {
		expect(collect("  - a\n    b\n  - c", 2, 4)).toEqual({ body: ["b"], end: 2 });
	});
});
