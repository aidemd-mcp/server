import { describe, expect, it } from "vitest";
import joinMeta from "./index.js";

describe("joinMeta", () => {
	it("joins the parts that are set with a middle dot", () => {
		expect(joinMeta(["aide-qa", "src/tools/score", "14:48"])).toBe("aide-qa · src/tools/score · 14:48");
	});

	it("leaves out null, undefined and empty parts", () => {
		expect(joinMeta([null, "a", undefined, "", "b"])).toBe("a · b");
	});

	it("is null when no part is set", () => {
		expect(joinMeta([null, undefined, ""])).toBeNull();
	});
});
