import { describe, expect, it } from "vitest";
import readTableAlign from "./index.js";

describe("readTableAlign", () => {
	it("reads each delimiter cell's alignment", () => {
		expect(readTableAlign(["---", ":--", "--:", ":-:"])).toEqual([null, "left", "right", "center"]);
	});

	it("returns null when any cell is not a delimiter, or there are no cells", () => {
		expect(readTableAlign(["---", "text"])).toBeNull();
		expect(readTableAlign(["- -"])).toBeNull();
		expect(readTableAlign([])).toBeNull();
	});
});
