import { describe, expect, it } from "vitest";
import type { HookInput } from "../types/index.js";
import findLinkedSession from "./index.js";

const make = (overrides: Partial<HookInput>): HookInput => ({
	session_id: "s1",
	hook_event_name: "PostToolUse",
	tool_name: "mcp__aide__aide_observer_event",
	...overrides,
});

describe("findLinkedSession", () => {
	it("finds the tag in an MCP content array", () => {
		const tool_response = { content: [{ type: "text", text: "recorded [observer-session obs-42]" }] };
		expect(findLinkedSession(make({ tool_response }))).toBe("obs-42");
	});

	it("finds the tag in a plain string response", () => {
		expect(findLinkedSession(make({ tool_response: "ok [observer-session obs-7]" }))).toBe("obs-7");
	});

	it("finds the tag for a plugin-prefixed tool name", () => {
		const input = make({ tool_name: "mcp__plugin_aide_aide__aide_observer_event", tool_response: "[observer-session obs-9]" });
		expect(findLinkedSession(input)).toBe("obs-9");
	});

	it("is null for another tool, even with a tag in the reply", () => {
		expect(findLinkedSession(make({ tool_name: "mcp__aide__aide_read", tool_response: "[observer-session obs-1]" }))).toBeNull();
	});

	it("is null for a non-PostToolUse event", () => {
		expect(findLinkedSession(make({ hook_event_name: "Stop", tool_response: "[observer-session obs-1]" }))).toBeNull();
	});

	it("is null for a reply without the tag, a missing reply or a missing tool name", () => {
		expect(findLinkedSession(make({ tool_response: "no tag here" }))).toBeNull();
		expect(findLinkedSession(make({ tool_response: undefined }))).toBeNull();
		expect(findLinkedSession(make({ tool_name: undefined, tool_response: "[observer-session obs-1]" }))).toBeNull();
	});

	it("is null for an unsafe id in the tag", () => {
		expect(findLinkedSession(make({ tool_response: "[observer-session ../x]" }))).toBeNull();
	});
});
