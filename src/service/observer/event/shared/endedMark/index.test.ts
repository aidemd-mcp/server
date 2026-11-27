import { describe, it, expect, expectTypeOf } from "vitest";
import { z } from "zod";
import { parse, type EndedMark } from "@/service/observer/event/shared/endedMark/index.js";
import { SESSION_ID_PATTERN } from "@/util/runtimePaths/shared/isSessionId/index.js";

const BASE = { v: 1, endedAt: "2026-11-25T10:00:00.000Z", endedBy: "hook" };
const OBSERVER_ID = "20261125T100000000Z-abc123";
const CLAUDE_ID = "c1f0a2b3-1111-4222-8333-444455556666";

const id = z.string().regex(SESSION_ID_PATTERN);

/** The zod schema `parse` replaced, as it stood before this change, with the SessionEnd fields: the recorded rules. */
const reference = z
	.object({
		v: z.literal(1),
		sessionId: id.optional(),
		claudeSessionId: id.optional(),
		endedAt: z.string().datetime(),
		endedBy: z.enum(["hook", "user", "transcript"]),
		bySessionId: id.optional(),
	})
	.strict()
	.refine((mark) => (mark.sessionId === undefined) !== (mark.claudeSessionId === undefined), {
		message: "exactly one of sessionId and claudeSessionId is required",
	});

describe("endedMark parse", () => {
	it("accepts a mark keyed by an observer session id", () => {
		expect(parse({ ...BASE, sessionId: OBSERVER_ID })).not.toBeNull();
	});

	it("accepts a mark keyed by a Claude session id", () => {
		expect(parse({ ...BASE, claudeSessionId: CLAUDE_ID, endedBy: "user" })).not.toBeNull();
	});

	it("accepts a user mark that names the ending session", () => {
		const result = parse({ ...BASE, sessionId: OBSERVER_ID, endedBy: "user", bySessionId: "other-1" });
		expect(result?.bySessionId).toBe("other-1");
	});

	it("accepts a transcript mark", () => {
		const result = parse({ ...BASE, sessionId: OBSERVER_ID, endedBy: "transcript", bySessionId: "other-1" });
		expect(result?.endedBy).toBe("transcript");
	});

	it("returns a new object", () => {
		const input = { ...BASE, sessionId: OBSERVER_ID };
		expect(parse(input)).not.toBe(input);
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
		expect(parse(value)).toBeNull();
	});
});

describe("endedMark parse agrees with the zod schema it replaced", () => {
	const proto = JSON.parse(`{"__proto__": 1, "v": 1, "sessionId": "${OBSERVER_ID}", "endedAt": "${BASE.endedAt}", "endedBy": "hook"}`);

	it.each([
		["sessionId alone", { ...BASE, sessionId: OBSERVER_ID }],
		["claudeSessionId alone", { ...BASE, claudeSessionId: CLAUDE_ID }],
		["both ids", { ...BASE, sessionId: OBSERVER_ID, claudeSessionId: CLAUDE_ID }],
		["neither id", { ...BASE }],
		["sessionId present, claudeSessionId undefined", { ...BASE, sessionId: OBSERVER_ID, claudeSessionId: undefined }],
		["claudeSessionId present, sessionId undefined", { ...BASE, sessionId: undefined, claudeSessionId: CLAUDE_ID }],
		["both ids undefined", { ...BASE, sessionId: undefined, claudeSessionId: undefined }],
		["bySessionId undefined", { ...BASE, sessionId: OBSERVER_ID, bySessionId: undefined }],
		["bySessionId with endedBy hook", { ...BASE, sessionId: OBSERVER_ID, endedBy: "hook", bySessionId: "other-1" }],
		["bySessionId with endedBy user", { ...BASE, sessionId: OBSERVER_ID, endedBy: "user", bySessionId: "other-1" }],
		["bySessionId with endedBy transcript", { ...BASE, sessionId: OBSERVER_ID, endedBy: "transcript", bySessionId: "other-1" }],
		["endedBy hook", { ...BASE, sessionId: OBSERVER_ID, endedBy: "hook" }],
		["endedBy user", { ...BASE, sessionId: OBSERVER_ID, endedBy: "user" }],
		["endedBy transcript", { ...BASE, sessionId: OBSERVER_ID, endedBy: "transcript" }],
		["endedBy unknown", { ...BASE, sessionId: OBSERVER_ID, endedBy: "timer" }],
		["endedBy uppercase", { ...BASE, sessionId: OBSERVER_ID, endedBy: "Hook" }],
		["endedAt with an offset", { ...BASE, sessionId: OBSERVER_ID, endedAt: "2026-11-25T10:00:00+01:00" }],
		["endedAt without Z", { ...BASE, sessionId: OBSERVER_ID, endedAt: "2026-11-25T10:00:00" }],
		["endedAt without milliseconds", { ...BASE, sessionId: OBSERVER_ID, endedAt: "2026-11-25T10:00:00Z" }],
		["endedAt a number", { ...BASE, sessionId: OBSERVER_ID, endedAt: 1 }],
		["sessionId a/b", { ...BASE, sessionId: "a/b" }],
		["sessionId ..", { ...BASE, sessionId: ".." }],
		["sessionId 129 chars", { ...BASE, sessionId: "a".repeat(129) }],
		["sessionId null", { ...BASE, sessionId: null }],
		["claudeSessionId unsafe", { ...BASE, claudeSessionId: "../x" }],
		["bySessionId unsafe", { ...BASE, sessionId: OBSERVER_ID, bySessionId: "a/b" }],
		["v 2", { ...BASE, v: 2, sessionId: OBSERVER_ID }],
		['v "1"', { ...BASE, v: "1", sessionId: OBSERVER_ID }],
		["an extra key", { ...BASE, sessionId: OBSERVER_ID, extra: 1 }],
		["a __proto__ key", proto],
		[
			"keys in another order",
			{ bySessionId: "other-1", endedBy: "user", endedAt: BASE.endedAt, claudeSessionId: CLAUDE_ID, v: 1 },
		],
		["no endedAt", { v: 1, sessionId: OBSERVER_ID, endedBy: "hook" }],
		["null", null],
		["an array", [{ ...BASE, sessionId: OBSERVER_ID }]],
		["a string", "mark"],
		["undefined", undefined],
	])("%s", (_name, value) => {
		const expected = reference.safeParse(value);
		const actual = parse(value);
		if (!expected.success) {
			expect(actual).toBeNull();
			return;
		}
		expect(actual).toEqual(expected.data);
		expect(JSON.stringify(actual)).toBe(JSON.stringify(expected.data));
	});

	it("has the type the zod schema inferred", () => {
		expectTypeOf<z.infer<typeof reference>>().toEqualTypeOf<EndedMark>();
	});
});
