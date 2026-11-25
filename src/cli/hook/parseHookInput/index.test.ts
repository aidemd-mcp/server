import { describe, expect, it } from "vitest";
import parseHookInput from "./index.js";

const valid = { session_id: "abc-123", hook_event_name: "Stop" };

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
