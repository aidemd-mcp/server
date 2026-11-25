import { describe, it, expect } from "vitest";
import aideHookEntries, { AIDE_HOOK_COMMAND } from "./index.js";
import aidePackage from "../../aidePackage/index.js";

describe("aideHookEntries", () => {
	it("lists the five events in order", () => {
		expect(aideHookEntries.map((entry) => entry.event)).toEqual([
			"SessionStart",
			"UserPromptSubmit",
			"PostToolUse",
			"Stop",
			"SessionEnd",
		]);
	});

	it("builds the command from the package command, never typed", () => {
		expect(AIDE_HOOK_COMMAND).toBe(`${aidePackage.command} hook`);
	});

	it.each(["SessionStart", "UserPromptSubmit", "Stop", "SessionEnd"])("%s has no matcher and no timeout", (event) => {
		const entry = aideHookEntries.find((candidate) => candidate.event === event);
		expect(entry?.group).toEqual({ hooks: [{ type: "command", command: AIDE_HOOK_COMMAND }] });
	});

	it("PostToolUse matches every tool", () => {
		const entry = aideHookEntries.find((candidate) => candidate.event === "PostToolUse");
		expect(entry?.group).toEqual({ matcher: "*", hooks: [{ type: "command", command: AIDE_HOOK_COMMAND }] });
	});
});
