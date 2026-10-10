import { describe, it, expect } from "vitest";
import invalidResultInstructions from "./index.js";

describe("invalidResultInstructions", () => {
	it("returns the exact brief #17 R10 wording", () => {
		expect(invalidResultInstructions()).toBe(
			"Applying this change would not leave a valid brain config, so nothing was written. Re-check brain state with `aide_info`.",
		);
	});
});
