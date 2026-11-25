import { describe, it, expect } from "vitest";
import { schema } from "@/service/observer/event/shared/presenceRecord/index.js";

const VALID = {
	v: 1,
	claudeSessionId: "c1f0a2b3-1111-4222-8333-444455556666",
	state: "working",
	at: "2026-11-25T10:00:00.000Z",
	hookEvent: "PostToolUse",
};

describe("presenceRecord schema", () => {
	it("accepts a presence without a link or a transcript", () => {
		expect(schema.safeParse(VALID).success).toBe(true);
	});

	it("accepts a linked presence with a transcript path and keeps both", () => {
		const result = schema.safeParse({
			...VALID,
			sessionId: "20261125T100000000Z-abc123",
			transcriptPath: "C:\\Users\\x\\.claude\\projects\\p\\t.jsonl",
		});
		expect(result.success).toBe(true);
		expect(result.data?.sessionId).toBe("20261125T100000000Z-abc123");
	});

	it.each(["working", "waiting", "ended"])("accepts state %s", (state) => {
		expect(schema.safeParse({ ...VALID, state }).success).toBe(true);
	});

	it.each(["SessionStart", "UserPromptSubmit", "PostToolUse", "Stop", "SessionEnd"])("accepts hookEvent %s", (hookEvent) => {
		expect(schema.safeParse({ ...VALID, hookEvent }).success).toBe(true);
	});

	it.each([
		["version 2", { ...VALID, v: 2 }],
		["an unsafe Claude id", { ...VALID, claudeSessionId: "../escape" }],
		["an unsafe linked id", { ...VALID, sessionId: "a/b" }],
		["an unknown state", { ...VALID, state: "idle" }],
		["an unknown hook event", { ...VALID, hookEvent: "PreToolUse" }],
		["a non-ISO time", { ...VALID, at: "yesterday" }],
		["an empty transcript path", { ...VALID, transcriptPath: "" }],
		["a transcript path over 1024 characters", { ...VALID, transcriptPath: "x".repeat(1025) }],
		["an extra key", { ...VALID, extra: true }],
		["no state", (({ state: _state, ...rest }) => rest)(VALID)],
	])("rejects %s", (_name, value) => {
		expect(schema.safeParse(value).success).toBe(false);
	});
});
