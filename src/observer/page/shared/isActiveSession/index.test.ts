import { describe, expect, it } from "vitest";
import isActiveSession from "./index.js";

describe("isActiveSession", () => {
	it.each([
		["live", true],
		["idle", true],
		["ended", false],
	] as const)("reads %s as %s", (liveness, expected) => {
		expect(isActiveSession({ liveness })).toBe(expected);
	});
});
