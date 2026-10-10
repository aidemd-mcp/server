import { describe, it, expect } from "vitest";
import sectionPurpose from "./index.js";
import brainContract from "@/service/brainContract/index.js";
import type { BrainSectionMarker } from "@/service/brainContract/index.js";

describe("sectionPurpose", () => {
	it.each(brainContract.map((entry) => [entry.marker, entry.purpose] as const))(
		"returns the contract purpose verbatim for %s",
		(marker, purpose) => {
			expect(sectionPurpose(marker)).toBe(purpose);
		},
	);

	it("throws naming the marker when it is not in the contract", () => {
		expect(() => sectionPurpose("banana" as BrainSectionMarker)).toThrow(/banana/);
	});
});
