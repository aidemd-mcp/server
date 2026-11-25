import { describe, it, expect } from "vitest";
import type { RecordOutcome } from "@/types/index.js";
import parseSessionTag from "@/service/observer/event/shared/parseSessionTag/index.js";
import formatReply from "./index.js";

const SESSION_ID = "2026-11-25T10-00-00Z-ab12";
const TAG = `[observer-session ${SESSION_ID}]`;

describe("formatReply", () => {
	it.each([
		["written", true, undefined, `recorded ${TAG}`],
		["written", false, undefined, `recorded; observer not running ${TAG}`],
		["write-failed", true, "disk full", `not recorded (disk full) ${TAG}`],
		["write-failed", false, "disk full", `not recorded (disk full); observer not running ${TAG}`],
		["invalid", true, "kind: bad", `not recorded: invalid event (kind: bad) ${TAG}`],
		["invalid", false, "kind: bad", `not recorded: invalid event (kind: bad) ${TAG}`],
		["repeat-session-start", true, undefined, `session already started; nothing recorded ${TAG}`],
		["repeat-session-start", false, undefined, `session already started; nothing recorded ${TAG}`],
		["session-ended", true, undefined, `refused: session ended ${TAG}`],
		["session-ended", false, undefined, `refused: session ended ${TAG}`],
	] as const)("%s with delivered=%s renders the exact line", (logged, delivered, detail, expected) => {
		const outcome: RecordOutcome = { logged, delivered, sessionId: SESSION_ID, ...(detail ? { detail } : {}) };

		expect(formatReply(outcome)).toBe(expected);
	});

	it("renders without empty parentheses when detail is absent", () => {
		expect(formatReply({ logged: "write-failed", delivered: true, sessionId: SESSION_ID })).toBe(`not recorded ${TAG}`);
		expect(formatReply({ logged: "invalid", delivered: true, sessionId: SESSION_ID })).toBe(`not recorded: invalid event ${TAG}`);
	});

	it.each(["written", "write-failed", "invalid", "repeat-session-start", "session-ended"] as const)(
		"%s reply ends with a tag the hook's parseSessionTag reads back",
		(logged) => {
			const reply = formatReply({ logged, delivered: false, sessionId: SESSION_ID });

			expect(reply.endsWith(TAG)).toBe(true);
			expect(parseSessionTag(reply)).toBe(SESSION_ID);
		},
	);

	it("keeps the not-running suffix before the tag", () => {
		const reply = formatReply({ logged: "written", delivered: false, sessionId: SESSION_ID });

		expect(reply.indexOf("; observer not running")).toBeGreaterThan(-1);
		expect(reply.indexOf("; observer not running")).toBeLessThan(reply.indexOf(TAG));
	});
});
