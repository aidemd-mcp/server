import { describe, it, expect, expectTypeOf } from "vitest";
import { z } from "zod";
import { parse, type Presence } from "@/service/observer/event/shared/presenceRecord/index.js";
import { SESSION_ID_PATTERN } from "@/util/runtimePaths/shared/isSessionId/index.js";

const VALID = {
	v: 1,
	claudeSessionId: "c1f0a2b3-1111-4222-8333-444455556666",
	state: "working",
	at: "2026-11-25T10:00:00.000Z",
	hookEvent: "PostToolUse",
};

const LINKED_ID = "20261125T100000000Z-abc123";
const PATH_1024 = "x".repeat(1024);

/** The zod schema `parse` replaced, as it stood before this change, with the SessionEnd fields (PATH_MAX inlined): the recorded rules. */
const reference = z
	.object({
		v: z.literal(1),
		claudeSessionId: z.string().regex(SESSION_ID_PATTERN),
		sessionId: z.string().regex(SESSION_ID_PATTERN).optional(),
		earlierSessionIds: z.array(z.string().regex(SESSION_ID_PATTERN)).max(100).optional(),
		state: z.enum(["working", "waiting", "ended"]),
		at: z.string().datetime(),
		hookEvent: z.enum(["SessionStart", "UserPromptSubmit", "PostToolUse", "Stop", "SessionEnd"]),
		transcriptPath: z.string().min(1).max(1024).optional(),
	})
	.strict();

const ids = (count: number) =>
	Array.from({ length: count }, (_, i) => `20261124T100000000Z-a${String(i).padStart(5, "0")}`);

describe("presenceRecord parse", () => {
	it("accepts a presence without a link or a transcript", () => {
		expect(parse(VALID)).not.toBeNull();
	});

	it("accepts a linked presence with a transcript path and keeps both", () => {
		const result = parse({
			...VALID,
			sessionId: LINKED_ID,
			transcriptPath: "C:\\Users\\x\\.claude\\projects\\p\\t.jsonl",
		});
		expect(result?.sessionId).toBe(LINKED_ID);
		expect(result?.transcriptPath).toBe("C:\\Users\\x\\.claude\\projects\\p\\t.jsonl");
	});

	it("accepts earlier session ids and keeps them", () => {
		const result = parse({
			...VALID,
			sessionId: LINKED_ID,
			earlierSessionIds: ["20261124T100000000Z-aaa111"],
		});
		expect(result?.earlierSessionIds).toEqual(["20261124T100000000Z-aaa111"]);
	});

	it("accepts exactly 100 earlier session ids and rejects 101", () => {
		expect(parse({ ...VALID, earlierSessionIds: ids(100) })).not.toBeNull();
		expect(parse({ ...VALID, earlierSessionIds: ids(101) })).toBeNull();
	});

	it("returns a new object and a copy of the earlier ids", () => {
		const input = { ...VALID, earlierSessionIds: ids(2) };
		const result = parse(input);
		expect(result).not.toBe(input);
		expect(result?.earlierSessionIds).not.toBe(input.earlierSessionIds);
	});

	it.each(["working", "waiting", "ended"])("accepts state %s", (state) => {
		expect(parse({ ...VALID, state })).not.toBeNull();
	});

	it.each(["SessionStart", "UserPromptSubmit", "PostToolUse", "Stop", "SessionEnd"])("accepts hookEvent %s", (hookEvent) => {
		expect(parse({ ...VALID, hookEvent })).not.toBeNull();
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
		["an unsafe earlier id", { ...VALID, earlierSessionIds: ["a/b"] }],
		["an extra key", { ...VALID, extra: true }],
		["no state", (({ state: _state, ...rest }) => rest)(VALID)],
	])("rejects %s", (_name, value) => {
		expect(parse(value)).toBeNull();
	});
});

describe("presenceRecord parse agrees with the zod schema it replaced", () => {
	const proto = JSON.parse(
		`{"__proto__": 1, "v": 1, "claudeSessionId": "${VALID.claudeSessionId}", "state": "working", "at": "${VALID.at}", "hookEvent": "Stop"}`,
	);
	const everyOptional = {
		...VALID,
		sessionId: LINKED_ID,
		earlierSessionIds: ids(3),
		transcriptPath: "/t.jsonl",
	};

	it.each([
		["the minimal record", VALID],
		["every optional present", everyOptional],
		["every optional undefined", { ...VALID, sessionId: undefined, earlierSessionIds: undefined, transcriptPath: undefined }],
		["sessionId undefined", { ...VALID, sessionId: undefined }],
		["earlierSessionIds undefined", { ...VALID, earlierSessionIds: undefined }],
		["transcriptPath undefined", { ...VALID, transcriptPath: undefined }],
		[
			"keys in another order",
			{
				transcriptPath: "/t.jsonl",
				hookEvent: "Stop",
				at: VALID.at,
				state: "waiting",
				earlierSessionIds: ids(2),
				sessionId: LINKED_ID,
				claudeSessionId: VALID.claudeSessionId,
				v: 1,
			},
		],
		["v 2", { ...VALID, v: 2 }],
		['v "1"', { ...VALID, v: "1" }],
		["state working", { ...VALID, state: "working" }],
		["state waiting", { ...VALID, state: "waiting" }],
		["state ended", { ...VALID, state: "ended" }],
		["an unknown state", { ...VALID, state: "idle" }],
		["an uppercase state", { ...VALID, state: "Working" }],
		["hookEvent SessionStart", { ...VALID, hookEvent: "SessionStart" }],
		["hookEvent UserPromptSubmit", { ...VALID, hookEvent: "UserPromptSubmit" }],
		["hookEvent PostToolUse", { ...VALID, hookEvent: "PostToolUse" }],
		["hookEvent Stop", { ...VALID, hookEvent: "Stop" }],
		["hookEvent SessionEnd", { ...VALID, hookEvent: "SessionEnd" }],
		["an unknown hookEvent", { ...VALID, hookEvent: "PreToolUse" }],
		["a lowercase hookEvent", { ...VALID, hookEvent: "stop" }],
		["at with milliseconds", { ...VALID, at: "2026-11-25T10:00:00.123Z" }],
		["at without milliseconds", { ...VALID, at: "2026-11-25T10:00:00Z" }],
		["at with an offset", { ...VALID, at: "2026-11-25T10:00:00+01:00" }],
		["at without Z", { ...VALID, at: "2026-11-25T10:00:00" }],
		["at yesterday", { ...VALID, at: "yesterday" }],
		["at a number", { ...VALID, at: 1 }],
		["a safe claudeSessionId", { ...VALID, claudeSessionId: "a.b_c-d" }],
		["claudeSessionId a/b", { ...VALID, claudeSessionId: "a/b" }],
		["claudeSessionId ..", { ...VALID, claudeSessionId: ".." }],
		["claudeSessionId 128 chars", { ...VALID, claudeSessionId: "a".repeat(128) }],
		["claudeSessionId 129 chars", { ...VALID, claudeSessionId: "a".repeat(129) }],
		["claudeSessionId a number", { ...VALID, claudeSessionId: 1 }],
		["sessionId a/b", { ...VALID, sessionId: "a/b" }],
		["sessionId ..", { ...VALID, sessionId: ".." }],
		["sessionId 129 chars", { ...VALID, sessionId: "a".repeat(129) }],
		["sessionId null", { ...VALID, sessionId: null }],
		["earlierSessionIds empty", { ...VALID, earlierSessionIds: [] }],
		["earlierSessionIds 100", { ...VALID, earlierSessionIds: ids(100) }],
		["earlierSessionIds 101", { ...VALID, earlierSessionIds: ids(101) }],
		["earlierSessionIds a bad id", { ...VALID, earlierSessionIds: [LINKED_ID, "a/b"] }],
		["earlierSessionIds repeated, unordered", { ...VALID, earlierSessionIds: ["b-1", "a-1", "b-1"] }],
		["earlierSessionIds not an array", { ...VALID, earlierSessionIds: LINKED_ID }],
		["earlierSessionIds a number element", { ...VALID, earlierSessionIds: [1] }],
		['transcriptPath ""', { ...VALID, transcriptPath: "" }],
		["transcriptPath 1", { ...VALID, transcriptPath: 1 }],
		["transcriptPath 1 char", { ...VALID, transcriptPath: "x" }],
		["transcriptPath 1024 chars", { ...VALID, transcriptPath: PATH_1024 }],
		["transcriptPath 1025 chars", { ...VALID, transcriptPath: `${PATH_1024}x` }],
		["an extra key", { ...VALID, extra: true }],
		["a __proto__ key", proto],
		["no claudeSessionId", (({ claudeSessionId: _id, ...rest }) => rest)(VALID)],
		["null", null],
		["an array", [VALID]],
		["a string", "presence"],
		["a number", 1],
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
		expectTypeOf<z.infer<typeof reference>>().toEqualTypeOf<Presence>();
	});
});
