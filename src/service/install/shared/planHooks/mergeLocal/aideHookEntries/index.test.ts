import { describe, it, expect } from "vitest";
import aideHookEntries from "./index.js";

const COMMAND = 'node "C:/npm/@aidemd-mcp/server/dist/index.js" hook';
const find = (event: string) => aideHookEntries(COMMAND).find((entry) => entry.event === event);

describe("aideHookEntries", () => {
	it("lists the five events in order", () => {
		expect(aideHookEntries(COMMAND).map((entry) => entry.event)).toEqual([
			"SessionStart",
			"UserPromptSubmit",
			"PostToolUse",
			"Stop",
			"SessionEnd",
		]);
	});

	it.each(["SessionStart", "UserPromptSubmit", "Stop"])("%s has no matcher and no timeout", (event) => {
		expect(find(event)?.group).toEqual({ hooks: [{ type: "command", command: COMMAND }] });
	});

	it("PostToolUse matches every tool", () => {
		expect(find("PostToolUse")?.group).toEqual({ matcher: "*", hooks: [{ type: "command", command: COMMAND }] });
	});

	it("SessionEnd alone carries a 10-second timeout", () => {
		expect(find("SessionEnd")?.group).toEqual({ hooks: [{ type: "command", command: COMMAND, timeout: 10 }] });
	});

	it("uses the given command verbatim", () => {
		for (const { group } of aideHookEntries("other hook")) expect(group.hooks[0].command).toBe("other hook");
	});
});
