import { describe, expect, it } from "vitest";
import makeLiveness from "@/observer/page/__fixtures__/makeLiveness/index.js";
import isActiveSession from "./index.js";

describe("isActiveSession", () => {
	it.each([
		["working", true],
		["waiting", true],
		["ended", false],
	] as const)("reads %s as %s", (state, expected) => {
		expect(isActiveSession({ liveness: makeLiveness({ state }) })).toBe(expected);
	});

	it("keeps a working session that has been quiet for hours active (never archivable)", () => {
		expect(isActiveSession({ liveness: makeLiveness({ state: "working", minutesQuiet: 300 }) })).toBe(true);
	});
});
