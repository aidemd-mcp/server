import { describe, expect, it } from "vitest";
import blockTexts from "./index.js";

describe("blockTexts", () => {
	it("gives each list item's text followed by the texts nested under it", () => {
		expect(
			blockTexts({
				type: "ul",
				items: [
					{ text: "a", blocks: [{ type: "ul", items: [{ text: "a1", blocks: [] }] }, { type: "p", text: "a note" }] },
					{ text: "b", blocks: [] },
				],
			}),
		).toEqual(["a", "a1", "a note", "b"]);
	});

	it("skips an item with no text of its own but keeps what is under it", () => {
		expect(blockTexts({ type: "ol", items: [{ text: "", blocks: [{ type: "code", text: "x" }] }] })).toEqual(["x"]);
	});

	it("joins a table's body rows and gives any other block its text", () => {
		expect(blockTexts({ type: "table", head: ["a", "b"], align: [null, null], rows: [["1", "2"]] })).toEqual(["1 · 2"]);
		expect(blockTexts({ type: "p", text: "para" })).toEqual(["para"]);
		expect(blockTexts({ type: "h", level: 2, text: "Head" })).toEqual(["Head"]);
	});
});
