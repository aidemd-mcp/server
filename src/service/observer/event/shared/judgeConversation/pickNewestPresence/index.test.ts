import { describe, it, expect } from "vitest";
import type { Presence } from "@/service/observer/event/shared/presenceRecord/index.js";
import pickNewestPresence from "./index.js";

function makePresence(claudeSessionId: string, at: string): Presence {
	return { v: 1, claudeSessionId, state: "working", at, hookEvent: "PostToolUse" };
}

describe("pickNewestPresence", () => {
	it("answers null for an empty list", () => {
		expect(pickNewestPresence({ presences: [] })).toBeNull();
	});

	it("picks the newest `at`, wherever it sits in the list", () => {
		const old = makePresence("claude-old", "2026-11-25T10:00:00.000Z");
		const fresh = makePresence("claude-new", "2026-11-25T10:05:00.000Z");
		const mid = makePresence("claude-mid", "2026-11-25T10:02:00.000Z");

		expect(pickNewestPresence({ presences: [old, fresh, mid] })).toBe(fresh);
		expect(pickNewestPresence({ presences: [fresh, old, mid] })).toBe(fresh);
	});

	it("keeps the earlier entry on a tie", () => {
		const first = makePresence("claude-1", "2026-11-25T10:00:00.000Z");
		const second = makePresence("claude-2", "2026-11-25T10:00:00.000Z");

		expect(pickNewestPresence({ presences: [first, second] })).toBe(first);
	});
});
