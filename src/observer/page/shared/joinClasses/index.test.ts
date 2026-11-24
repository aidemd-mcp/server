import { describe, expect, it } from "vitest";
import joinClasses from "./index.js";

describe("joinClasses", () => {
	it("joins the set names in order", () => {
		expect(joinClasses("av-conn", "live")).toBe("av-conn live");
	});

	it("skips false, null, undefined and empty names", () => {
		expect(joinClasses("ic", false, null, undefined, "", "i-run", 1 > 2 && "spin")).toBe("ic i-run");
	});

	it("returns an empty string when nothing is set", () => {
		expect(joinClasses(false, undefined)).toBe("");
	});
});
