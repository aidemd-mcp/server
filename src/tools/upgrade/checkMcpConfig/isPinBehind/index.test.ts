import { describe, it, expect } from "vitest";
import isPinBehind from "./index.js";

describe("isPinBehind", () => {
	it.each([
		[null, "0.13.1", true],
		["0.12.0", "0.13.1", true],
		["0.9.9", "0.10.0", true],
		["latest", "0.13.1", true],
		["^0.12.0", "0.13.1", true],
		["0.13.1", "0.13.1", false],
		["0.14.0", "0.13.1", false],
		["1.0.0", "0.13.1", false],
		["0.99.0-rc.1", "0.13.1", false],
		["0.14.0-alpha.2", "0.13.1", false],
		["0.13.1-rc.1", "0.13.1", true],
		["0.12.0-beta", "0.13.1", true],
		["^0.99.0-rc.1", "0.13.1", true],
	])("pin %s against target %s is %s", (version, target, expected) => {
		expect(isPinBehind(version, target)).toBe(expected);
	});
});
