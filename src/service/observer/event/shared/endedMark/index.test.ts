import { describe, it, expect } from "vitest";
import { schema } from "@/service/observer/event/shared/endedMark/index.js";

const BASE = { v: 1, endedAt: "2026-11-25T10:00:00.000Z", endedBy: "hook" };
const OBSERVER_ID = "20261125T100000000Z-abc123";
const CLAUDE_ID = "c1f0a2b3-1111-4222-8333-444455556666";

describe("endedMark schema", () => {
	it("accepts a mark keyed by an observer session id", () => {
		expect(schema.safeParse({ ...BASE, sessionId: OBSERVER_ID }).success).toBe(true);
	});

	it("accepts a mark keyed by a Claude session id", () => {
		expect(schema.safeParse({ ...BASE, claudeSessionId: CLAUDE_ID, endedBy: "user" }).success).toBe(true);
	});

	it("accepts a user mark that names the ending session", () => {
		const result = schema.safeParse({ ...BASE, sessionId: OBSERVER_ID, endedBy: "user", bySessionId: "other-1" });
		expect(result.success).toBe(true);
		expect(result.data?.bySessionId).toBe("other-1");
	});

	it.each([
		["neither id", { ...BASE }],
		["both ids", { ...BASE, sessionId: OBSERVER_ID, claudeSessionId: CLAUDE_ID }],
		["version 2", { ...BASE, v: 2, sessionId: OBSERVER_ID }],
		["an unsafe id", { ...BASE, sessionId: "../x" }],
		["an unknown endedBy", { ...BASE, sessionId: OBSERVER_ID, endedBy: "timer" }],
		["a non-ISO time", { ...BASE, sessionId: OBSERVER_ID, endedAt: "now" }],
		["an unsafe bySessionId", { ...BASE, sessionId: OBSERVER_ID, bySessionId: "a/b" }],
		["an extra key", { ...BASE, sessionId: OBSERVER_ID, extra: 1 }],
	])("rejects %s", (_name, value) => {
		expect(schema.safeParse(value).success).toBe(false);
	});
});
