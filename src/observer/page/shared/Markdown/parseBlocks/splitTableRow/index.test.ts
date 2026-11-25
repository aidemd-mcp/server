import { describe, expect, it } from "vitest";
import splitTableRow from "./index.js";

describe("splitTableRow", () => {
	it("splits a row into trimmed cells, with or without outer pipes", () => {
		expect(splitTableRow("| a | b |")).toEqual(["a", "b"]);
		expect(splitTableRow("a | b")).toEqual(["a", "b"]);
		expect(splitTableRow("| a |  |")).toEqual(["a", ""]);
	});

	it("reads an escaped pipe as part of the cell", () => {
		expect(splitTableRow("| a \\| b | c |")).toEqual(["a | b", "c"]);
	});

	it("returns null for a line with no pipe", () => {
		expect(splitTableRow("plain text")).toBeNull();
		expect(splitTableRow("a \\| b")).toBeNull();
	});
});
