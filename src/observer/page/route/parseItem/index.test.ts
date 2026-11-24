import { describe, expect, it } from "vitest";
import parseItem from "./index.js";

describe("parseItem", () => {
	it.each([
		["module:src/tools/score", { kind: "module", folder: "src/tools/score" }],
		["module:.", { kind: "module", folder: "." }],
		["task:fix-login-bug", { kind: "task", slug: "fix-login-bug" }],
		["file:src/tools/score/plan.aide", { kind: "file", path: "src/tools/score/plan.aide" }],
		["file:C:/odd:name.aide", { kind: "file", path: "C:/odd:name.aide" }],
		["event:20260101T000000000Z-abcdef:7", { kind: "event", sessionId: "20260101T000000000Z-abcdef", seq: 7 }],
		["event:a:b:12", { kind: "event", sessionId: "a:b", seq: 12 }],
	])("reads %s", (raw, expected) => {
		expect(parseItem(raw)).toEqual(expected);
	});

	it.each([
		null,
		"",
		"module",
		"module:",
		"task:",
		"file:",
		"nonsense:thing",
		"event:s",
		"event::3",
		"event:s:",
		"event:s:0",
		"event:s:-2",
		"event:s:1.5",
		"event:s:abc",
		"event:s:99999999999999999999",
	])("rejects %j", (raw) => {
		expect(parseItem(raw)).toBeNull();
	});
});
