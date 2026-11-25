import { describe, expect, it } from "vitest";
import formatPortNote from "./index.js";

describe("formatPortNote", () => {
	it("returns null when the observer is on the requested port", () => {
		expect(formatPortNote({ requested: 24680, actual: 24680 })).toBeNull();
	});

	it("names both ports when the observer is on another one", () => {
		expect(formatPortNote({ requested: 24680, actual: 24683 })).toBe(
			"Port 24680 was not used; the observer is on port 24683.",
		);
	});
});
