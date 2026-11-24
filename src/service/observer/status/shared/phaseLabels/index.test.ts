import { describe, it, expect } from "vitest";
import PHASE_LABELS from "./index.js";

describe("PHASE_LABELS", () => {
	it("pins every phase label in the closed list's order", () => {
		expect(Object.entries(PHASE_LABELS)).toEqual([
			["spec", "Spec"],
			["research", "Research"],
			["synthesize", "Synthesize"],
			["structure", "Structure"],
			["plan", "Plan"],
			["build", "Build"],
			["qa", "QA"],
			["fix", "Fix"],
			["align", "Align"],
			["refactor", "Refactor"],
			["cleanup", "Cleanup"],
		]);
	});
});
