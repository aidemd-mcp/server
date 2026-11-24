import { describe, expect, it } from "vitest";
import isFixRound from "./index.js";

describe("isFixRound", () => {
	it.each([
		["fix", undefined, true],
		["fix", 1, true],
		["qa", 2, true],
		["qa", 3, true],
		["qa", 1, false],
		["qa", undefined, false],
		["build", 2, false],
	] as const)("%s with round %s is %s", (phase, qaFixRound, expected) => {
		expect(isFixRound({ work: { phase, qaFixRound } })).toBe(expected);
	});
});
