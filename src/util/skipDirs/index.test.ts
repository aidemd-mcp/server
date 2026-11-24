import { describe, it, expect } from "vitest";
import SKIP_DIRS from "./index.js";

describe("SKIP_DIRS", () => {
	it("lists the seven skipped folders in order", () => {
		expect(SKIP_DIRS).toEqual([
			"node_modules",
			".git",
			"dist",
			"build",
			".next",
			"coverage",
			"__pycache__",
		]);
	});
});
