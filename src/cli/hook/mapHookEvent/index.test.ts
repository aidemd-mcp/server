import { describe, expect, it } from "vitest";
import type { HookInput } from "../types/index.js";
import mapHookEvent from "./index.js";

const make = (hook_event_name: string, reason?: string): HookInput => ({ session_id: "s1", hook_event_name, reason });

describe("mapHookEvent", () => {
	it.each(["SessionStart", "UserPromptSubmit", "PostToolUse"])("%s maps to working", (name) => {
		expect(mapHookEvent(make(name))).toEqual({ hookEvent: name, state: "working", endsObserverSession: false });
	});

	it("Stop maps to waiting, never ended", () => {
		expect(mapHookEvent(make("Stop"))).toEqual({ hookEvent: "Stop", state: "waiting", endsObserverSession: false });
	});

	it.each([undefined, "logout", "prompt_input_exit", "other"])("SessionEnd with reason %s ends the observer session", (reason) => {
		expect(mapHookEvent(make("SessionEnd", reason))).toEqual({ hookEvent: "SessionEnd", state: "ended", endsObserverSession: true });
	});

	it.each(["clear", "resume"])("SessionEnd with reason %s keeps the observer session", (reason) => {
		expect(mapHookEvent(make("SessionEnd", reason))).toEqual({ hookEvent: "SessionEnd", state: "ended", endsObserverSession: false });
	});

	it.each(["PreToolUse", "Notification", "SubagentStop", "PreCompact", ""])("%s maps to null", (name) => {
		expect(mapHookEvent(make(name))).toBeNull();
	});
});
