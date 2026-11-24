import { describe, expect, it } from "vitest";
import sameText from "./index.js";

describe("sameText", () => {
	it("ignores case and whitespace runs", () => {
		expect(sameText("Define  the Types ", "define the types")).toBe(true);
	});

	it("tells different texts apart", () => {
		expect(sameText("Create types", "Types")).toBe(false);
	});
});
