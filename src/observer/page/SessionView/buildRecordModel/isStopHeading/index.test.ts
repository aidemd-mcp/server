import { describe, expect, it } from "vitest";
import isStopHeading from "./index.js";

describe("isStopHeading", () => {
	it.each([
		["Where this cycle stopped", true],
		["  where this cycle stopped (round 2)", true],
		["State summary", false],
		["Notes on where this cycle stopped", false],
	])("%s is %s", (heading, expected) => {
		expect(isStopHeading(heading)).toBe(expected);
	});
});
