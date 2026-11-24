import { describe, expect, it } from "vitest";
import pageAssets from "./index.js";

describe("pageAssets", () => {
	it("types exactly the script and stylesheet it names", () => {
		expect(Object.keys(pageAssets.contentTypes).sort()).toEqual([pageAssets.script, pageAssets.stylesheet].sort());
	});
});
