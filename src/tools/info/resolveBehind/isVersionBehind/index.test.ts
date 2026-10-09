import { describe, it, expect } from "vitest";
import isVersionBehind from "./index.js";

describe("isVersionBehind", () => {
	it.each([
		["0.9.0", "0.10.0", true],
		["0.10.0", "0.9.0", false],
		["1.2.3", "1.2.3", false],
		["1.0.0-beta", "1.0.0", false],
		["1.0.0", "1.0.1+build5", true],
		["garbage", "1.0.0", false],
		["1.0.0", "garbage", false],
		["1.0", "1.0.1", false],
	])("installed %s vs latest %s -> %s", (installed, latest, expected) => {
		expect(isVersionBehind(installed, latest)).toBe(expected);
	});
});
