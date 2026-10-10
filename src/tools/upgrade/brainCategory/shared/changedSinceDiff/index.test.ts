import { describe, it, expect } from "vitest";
import changedSinceDiff from "./index.js";

describe("changedSinceDiff", () => {
	it("returns the exact brief #17 R9 wording with the target interpolated", () => {
		expect(changedSinceDiff("launcher")).toBe(
			'The `launcher` text changed after its diff was shown, so nothing was written. Fetch the diff again with `aide_upgrade`, `category: "brain"` and `brainChange: "launcher"` (no `beforeHash`), show it to the user, and apply only on their yes.',
		);
	});
});
