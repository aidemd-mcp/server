import { describe, expect, it } from "vitest";
import pageTitle from "./index.js";

describe("pageTitle", () => {
	it("is the observer page's base title copy", () => {
		expect(pageTitle).toBe("AIDE Pipeline Viewer");
	});
});
