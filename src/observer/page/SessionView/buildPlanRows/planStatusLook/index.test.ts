import { describe, expect, it } from "vitest";
import PLAN_STATUS_LOOK from "./index.js";

describe("PLAN_STATUS_LOOK", () => {
	it.each([
		["proposed", { word: "Proposed", tone: "warn", icon: "gate" }],
		["approved", { word: "Approved", tone: "run", icon: "run" }],
		["completed", { word: "Completed", tone: "done", icon: "done" }],
		["abandoned", { word: "Abandoned", tone: "outline", icon: "close" }],
		["unset", { word: "No status", tone: "outline", icon: "todo" }],
	])("looks up %s", (status, look) => {
		expect(PLAN_STATUS_LOOK[status]).toEqual(look);
	});

	it("gives every status a distinct word, so no status rests on colour alone", () => {
		const words = Object.values(PLAN_STATUS_LOOK).map((look) => look.word);
		expect(new Set(words).size).toBe(words.length);
	});
});
