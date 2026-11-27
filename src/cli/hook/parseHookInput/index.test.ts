import { describe, expect, expectTypeOf, it } from "vitest";
import { z } from "zod";
import parseHookInput from "./index.js";
import type { HookInput } from "../types/index.js";
import isSessionId from "@/util/runtimePaths/shared/isSessionId/index.js";

const valid = { session_id: "abc-123", hook_event_name: "Stop" };

/** The zod schema `parseHookInput` replaced, copied verbatim from git HEAD: the recorded rules. */
const reference = z
	.object({
		session_id: z.string().refine(isSessionId),
		hook_event_name: z.string(),
		transcript_path: z.string().max(1024).optional(),
		cwd: z.string().optional(),
		reason: z.string().optional(),
		tool_name: z.string().optional(),
		tool_input: z.unknown().optional(),
		tool_response: z.unknown().optional(),
	})
	.passthrough();

describe("parseHookInput", () => {
	it("parses the fields the hook reads and keeps extras", () => {
		const input = parseHookInput(
			JSON.stringify({ ...valid, transcript_path: "/t.jsonl", cwd: "/p", reason: "clear", tool_name: "x", extra: 1 }),
		);
		expect(input).toMatchObject({ session_id: "abc-123", hook_event_name: "Stop", transcript_path: "/t.jsonl", cwd: "/p", extra: 1 });
	});

	it.each([
		["malformed JSON", "{nope"],
		["a non-object", "42"],
		["a missing session_id", JSON.stringify({ hook_event_name: "Stop" })],
		["a missing hook_event_name", JSON.stringify({ session_id: "abc" })],
		["a session id with a forward slash", JSON.stringify({ ...valid, session_id: "a/b" })],
		["a session id with a backslash", JSON.stringify({ ...valid, session_id: "a\b" })],
		["a session id with dot-dot", JSON.stringify({ ...valid, session_id: ".." })],
		["an over-long transcript_path", JSON.stringify({ ...valid, transcript_path: "x".repeat(1025) })],
	])("returns null for %s", (_label, text) => {
		expect(parseHookInput(text)).toBeNull();
	});
});

describe("parseHookInput agrees with the zod schema it replaced", () => {
	const withKey = (key: string, value: unknown) => JSON.stringify({ ...valid, [key]: value });
	const optionalStrings = ["transcript_path", "cwd", "reason", "tool_name"] as const;

	const table: Array<[string, string]> = [
		["the minimal input", JSON.stringify(valid)],
		[
			"every optional field present",
			JSON.stringify({
				...valid,
				transcript_path: "/t.jsonl",
				cwd: "/p",
				reason: "clear",
				tool_name: "Bash",
				tool_input: { command: "ls" },
				tool_response: { ok: true },
			}),
		],
		["an extra string key", withKey("extra", "x")],
		["an extra number key", withKey("extra", 1)],
		["an extra boolean key", withKey("extra", true)],
		["an extra null key", withKey("extra", null)],
		["an extra array key", withKey("extra", [1, "a", null])],
		["an extra object key", withKey("extra", { a: { b: 1 } })],
		["tool_input as an object", withKey("tool_input", { a: 1 })],
		["tool_input as an array", withKey("tool_input", [1, 2])],
		["tool_input as a string", withKey("tool_input", "s")],
		["tool_input as null", withKey("tool_input", null)],
		["tool_response as an object", withKey("tool_response", { a: 1 })],
		["tool_response as an array", withKey("tool_response", [1, 2])],
		["tool_response as a string", withKey("tool_response", "s")],
		["tool_response as null", withKey("tool_response", null)],
		["a transcript_path of 0 characters", withKey("transcript_path", "")],
		["a transcript_path of 1 024 characters", withKey("transcript_path", "x".repeat(1024))],
		["a transcript_path of 1 025 characters", withKey("transcript_path", "x".repeat(1025))],
		...optionalStrings.flatMap((key): Array<[string, string]> => [
			[`${key} as a number`, withKey(key, 1)],
			[`${key} as null`, withKey(key, null)],
			[`${key} as an object`, withKey(key, { a: 1 })],
			[`${key} as an array`, withKey(key, ["a"])],
			[`${key} as a boolean`, withKey(key, false)],
			[`${key} as a string`, withKey(key, "v")],
		]),
		["a session_id as a number", JSON.stringify({ ...valid, session_id: 1 })],
		["a session_id as null", JSON.stringify({ ...valid, session_id: null })],
		["an empty session_id", JSON.stringify({ ...valid, session_id: "" })],
		["a session_id of 128 characters", JSON.stringify({ ...valid, session_id: "a".repeat(128) })],
		["a session_id of 129 characters", JSON.stringify({ ...valid, session_id: "a".repeat(129) })],
		["a session_id with a leading dot", JSON.stringify({ ...valid, session_id: ".abc" })],
		["a session_id of dot-dot", JSON.stringify({ ...valid, session_id: ".." })],
		["a session_id with a forward slash", JSON.stringify({ ...valid, session_id: "a/b" })],
		["a session_id with a backslash", JSON.stringify({ ...valid, session_id: "a\\b" })],
		["no session_id", JSON.stringify({ hook_event_name: "Stop" })],
		["an empty hook_event_name", JSON.stringify({ ...valid, hook_event_name: "" })],
		["no hook_event_name", JSON.stringify({ session_id: "abc" })],
		["a hook_event_name as a number", JSON.stringify({ ...valid, hook_event_name: 1 })],
		["a null root", "null"],
		["an array root", "[]"],
		["an array root holding the fields", JSON.stringify([valid])],
		["a number root", "42"],
		["a string root", JSON.stringify("text")],
		["a true root", "true"],
		["a __proto__ key", `{"__proto__": {"x": 1}, "session_id": "abc", "hook_event_name": "Stop"}`],
		["a __proto__ key set to null", `{"__proto__": null, "session_id": "abc", "hook_event_name": "Stop"}`],
	];

	it.each(table)("agrees on %s", (_label, text) => {
		const expected = reference.safeParse(JSON.parse(text));
		const actual = parseHookInput(text);
		if (expected.success) {
			expect(actual).not.toBeNull();
			expect(actual).toEqual(expected.data);
		} else {
			expect(actual).toBeNull();
		}
	});

	it("accepts and rejects at least one case each, so the table is not vacuous", () => {
		const outcomes = table.map(([, text]) => reference.safeParse(JSON.parse(text)).success);
		expect(outcomes).toContain(true);
		expect(outcomes).toContain(false);
	});

	it("pins HookInput to the type the zod schema infers", () => {
		expectTypeOf<z.infer<typeof reference>>().toEqualTypeOf<HookInput>();
	});
});
