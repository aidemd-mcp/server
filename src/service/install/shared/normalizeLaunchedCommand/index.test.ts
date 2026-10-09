import { describe, it, expect } from "vitest";
import normalizeLaunchedCommand from "./index.js";

describe("normalizeLaunchedCommand", () => {
	it.each([
		["npx", [], { token: "npx", viaPath: false }],
		["C:\\nodejs\\npx.cmd", [], { token: "npx", viaPath: true }],
		["cmd", ["/c", "aidemd-mcp"], { token: "aidemd-mcp", viaPath: false }],
		[
			"cmd.exe",
			["/C", "C:\\Users\\x\\AppData\\Roaming\\npm\\aidemd-mcp.cmd"],
			{ token: "aidemd-mcp", viaPath: true },
		],
		["node", ["dist/index.js"], { token: "node", viaPath: false }],
	])("normalizes %s %j", (command, args, expected) => {
		expect(normalizeLaunchedCommand({ command, args })).toEqual(expected);
	});

	it("returns null for a non-string command", () => {
		expect(normalizeLaunchedCommand({ command: 42, args: [] })).toBeNull();
	});

	it("returns null for cmd with no args", () => {
		expect(normalizeLaunchedCommand({ command: "cmd", args: undefined })).toBeNull();
	});

	it.each([
		[["/k", "npx"]],
		[["/c"]],
		[[]],
		[["/c", 5]],
	])("returns null for cmd with unusable args %j", (args) => {
		expect(normalizeLaunchedCommand({ command: "cmd", args })).toBeNull();
	});
});
