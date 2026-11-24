import { describe, it, expect } from "vitest";
import type { RecordOutcome } from "@/types/index.js";
import formatReply from "./index.js";

describe("formatReply", () => {
	it.each([
		["written", true, undefined, "recorded"],
		["written", false, undefined, "recorded; observer not running"],
		["write-failed", true, "disk full", "not recorded (disk full)"],
		["write-failed", false, "disk full", "not recorded (disk full); observer not running"],
		["invalid", true, "kind: bad", "not recorded: invalid event (kind: bad)"],
		["invalid", false, "kind: bad", "not recorded: invalid event (kind: bad)"],
		["repeat-session-start", true, undefined, "session already started; nothing recorded"],
		["repeat-session-start", false, undefined, "session already started; nothing recorded"],
	] as const)("%s with delivered=%s renders the exact line", (logged, delivered, detail, expected) => {
		const outcome: RecordOutcome = { logged, delivered, ...(detail ? { detail } : {}) };

		expect(formatReply(outcome)).toBe(expected);
	});

	it("renders without empty parentheses when detail is absent", () => {
		expect(formatReply({ logged: "write-failed", delivered: true })).toBe("not recorded");
		expect(formatReply({ logged: "invalid", delivered: true })).toBe("not recorded: invalid event");
	});
});
