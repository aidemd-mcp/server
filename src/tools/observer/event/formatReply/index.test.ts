import { describe, it, expect } from "vitest";
import type { RecordOutcome } from "@/types/index.js";
import parseSessionTag from "@/service/observer/event/shared/parseSessionTag/index.js";
import formatReply from "./index.js";

const SESSION_ID = "2026-11-25T10-00-00Z-ab12";
const TAG = `[observer-session ${SESSION_ID}]`;
const ENDED = "; previously ended: run aide_observer_start before anything else";

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
	] as const)("%s with delivered=%s renders the exact line without the flag", (logged, delivered, detail, expected) => {
		const outcome: RecordOutcome = {
			logged,
			delivered,
			sessionId: SESSION_ID,
			previouslyEnded: false,
			...(detail ? { detail } : {}),
		};

		expect(formatReply(outcome)).toBe(expected);
	});

	it.each([
		["written", true, undefined, `recorded${ENDED} ${TAG}`],
		["written", false, undefined, `recorded; observer not running${ENDED} ${TAG}`],
		["write-failed", true, "disk full", `not recorded (disk full)${ENDED} ${TAG}`],
		["write-failed", false, "disk full", `not recorded (disk full); observer not running${ENDED} ${TAG}`],
		["repeat-session-start", true, undefined, `session already started; nothing recorded${ENDED} ${TAG}`],
		["repeat-session-start", false, undefined, `session already started; nothing recorded${ENDED} ${TAG}`],
	] as const)("%s with delivered=%s and previouslyEnded renders the clause before the tag", (logged, delivered, detail, expected) => {
		const outcome: RecordOutcome = {
			logged,
			delivered,
			sessionId: SESSION_ID,
			previouslyEnded: true,
			...(detail ? { detail } : {}),
		};

		expect(formatReply(outcome)).toBe(expected);
	});

	it("renders the exact previously-ended clause text", () => {
		const reply = formatReply({ logged: "written", delivered: true, sessionId: SESSION_ID, previouslyEnded: true });

		expect(reply).toBe(
			`recorded; previously ended: run aide_observer_start before anything else [observer-session ${SESSION_ID}]`,
		);
	});

	it("renders without empty parentheses when detail is absent", () => {
		expect(
			formatReply({ logged: "write-failed", delivered: true, sessionId: SESSION_ID, previouslyEnded: false }),
		).toBe(`not recorded ${TAG}`);
		expect(formatReply({ logged: "invalid", delivered: true, sessionId: SESSION_ID, previouslyEnded: false })).toBe(
			`not recorded: invalid event ${TAG}`,
		);
	});

	it.each(["written", "write-failed", "invalid", "repeat-session-start"] as const)(
		"%s reply ends with a tag the hook's parseSessionTag reads back, flagged or not",
		(logged) => {
			for (const previouslyEnded of [false, true]) {
				const reply = formatReply({ logged, delivered: false, sessionId: SESSION_ID, previouslyEnded });

				expect(reply.endsWith(TAG)).toBe(true);
				expect(parseSessionTag(reply)).toBe(SESSION_ID);
			}
		},
	);

	it("keeps the not-running suffix, then the previously-ended clause, then the tag", () => {
		const reply = formatReply({ logged: "written", delivered: false, sessionId: SESSION_ID, previouslyEnded: true });

		expect(reply.indexOf("; observer not running")).toBeGreaterThan(-1);
		expect(reply.indexOf("; observer not running")).toBeLessThan(reply.indexOf("; previously ended"));
		expect(reply.indexOf("; previously ended")).toBeLessThan(reply.indexOf(TAG));
	});
});
