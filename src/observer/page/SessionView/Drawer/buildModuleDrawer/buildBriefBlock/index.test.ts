import { describe, expect, it } from "vitest";
import buildBriefBlock from "./index.js";

describe("buildBriefBlock", () => {
	it("is the brief's text as one pre block", () => {
		expect(buildBriefBlock({ text: "1. Commitment" })).toEqual({ heading: "Brief", icon: "doc", badge: null, type: "pre", text: "1. Commitment" });
	});
});
