import { describe, it, expect } from "vitest";
import findWiredEvents from "./index.js";
import { AIDE_HOOK_COMMAND } from "../aideHookEntries/index.js";

const wiredGroup = (command: string = AIDE_HOOK_COMMAND, type = "command") => ({ hooks: [{ type, command }] });

describe("findWiredEvents", () => {
	it("finds events whose array holds AIDE's command", () => {
		const wired = findWiredEvents({ hooks: { Stop: [wiredGroup()], SessionEnd: [wiredGroup()] } });
		expect([...wired].sort()).toEqual(["SessionEnd", "Stop"]);
	});

	it("recognises the group after a user's own group and with a matcher", () => {
		const wired = findWiredEvents({
			hooks: { PostToolUse: [{ hooks: [{ type: "command", command: "echo hi" }] }, { matcher: "Bash", ...wiredGroup() }] },
		});
		expect([...wired]).toEqual(["PostToolUse"]);
	});

	it("trims the command before comparing", () => {
		expect(findWiredEvents({ hooks: { Stop: [wiredGroup(`  ${AIDE_HOOK_COMMAND}\n`)] } }).has("Stop")).toBe(true);
	});

	it.each([
		["a different command", { hooks: { Stop: [wiredGroup("aidemd-mcp hooks")] } }],
		["a non-command type", { hooks: { Stop: [wiredGroup(AIDE_HOOK_COMMAND, "prompt")] } }],
		["a non-array event", { hooks: { Stop: wiredGroup() } }],
		["a non-array group hooks", { hooks: { Stop: [{ hooks: wiredGroup() }] } }],
		["a non-object hooks key", { hooks: [wiredGroup()] }],
		["no hooks key", { other: 1 }],
		["a non-object root", [wiredGroup()]],
		["null", null],
		["a string", "hooks"],
	])("treats %s as not wired", (_label, settings) => {
		expect(findWiredEvents(settings).size).toBe(0);
	});
});
