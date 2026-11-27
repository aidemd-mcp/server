import { describe, it, expect } from "vitest";
import findWiredEvents from "./index.js";
import aideHookEntries from "../aideHookEntries/index.js";

const COMMAND = 'node "C:/npm/@aidemd-mcp/server/dist/index.js" hook';
const entries = aideHookEntries(COMMAND);
const groupOf = (event: string) => entries.find((entry) => entry.event === event)!.group;
const hookGroup = (command: string, extra: Record<string, unknown> = {}) => ({
	hooks: [{ type: "command", command, ...extra }],
});
const wired = (settings: unknown) => [...findWiredEvents({ settings, entries })].sort();

describe("findWiredEvents", () => {
	it("finds every event of the current entries", () => {
		const hooks = Object.fromEntries(entries.map(({ event, group }) => [event, [group]]));
		expect(wired({ hooks })).toEqual(["PostToolUse", "SessionEnd", "SessionStart", "Stop", "UserPromptSubmit"]);
	});

	it("recognises the current hook after a user's group and under another matcher", () => {
		expect(
			wired({
				hooks: { PostToolUse: [hookGroup("echo hi"), { matcher: "Bash", ...groupOf("PostToolUse") }] },
			}),
		).toEqual(["PostToolUse"]);
	});

	it("the old `aidemd-mcp hook` form is not wired", () => {
		expect(wired({ hooks: { Stop: [hookGroup("aidemd-mcp hook")] } })).toEqual([]);
	});

	it("the right command without the SessionEnd timeout is not wired", () => {
		expect(wired({ hooks: { SessionEnd: [hookGroup(COMMAND)] } })).toEqual([]);
	});

	it("the SessionEnd hook with the timeout is wired, with another timeout it is not", () => {
		expect(wired({ hooks: { SessionEnd: [hookGroup(COMMAND, { timeout: 10 })] } })).toEqual(["SessionEnd"]);
		expect(wired({ hooks: { SessionEnd: [hookGroup(COMMAND, { timeout: 30 })] } })).toEqual([]);
	});

	it("a timeout on an event whose entry has none is not wired", () => {
		expect(wired({ hooks: { Stop: [hookGroup(COMMAND, { timeout: 10 })] } })).toEqual([]);
	});

	it("two AIDE hooks in one event are not wired", () => {
		expect(wired({ hooks: { Stop: [hookGroup(COMMAND), hookGroup("aidemd-mcp hook")] } })).toEqual([]);
		expect(
			wired({
				hooks: { Stop: [{ hooks: [{ type: "command", command: COMMAND }, { type: "command", command: COMMAND }] }] },
			}),
		).toEqual([]);
	});

	it("a path that differs from the entry is not wired", () => {
		expect(wired({ hooks: { Stop: [hookGroup('node "D:/other/@aidemd-mcp/server/dist/index.js" hook')] } })).toEqual([]);
	});

	it.each([
		["a non-command type", { hooks: { Stop: [{ hooks: [{ type: "prompt", command: COMMAND }] }] } }],
		["a non-array event", { hooks: { Stop: hookGroup(COMMAND) } }],
		["a non-array group hooks", { hooks: { Stop: [{ hooks: hookGroup(COMMAND) }] } }],
		["a non-object hooks key", { hooks: [hookGroup(COMMAND)] }],
		["no hooks key", { other: 1 }],
		["a non-object root", [hookGroup(COMMAND)]],
		["null", null],
		["a string", "hooks"],
	])("treats %s as not wired", (_label, settings) => {
		expect(wired(settings)).toEqual([]);
	});
});
