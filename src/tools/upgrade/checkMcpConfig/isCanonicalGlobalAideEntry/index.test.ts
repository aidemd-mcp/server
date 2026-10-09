import { describe, it, expect } from "vitest";
import isCanonicalGlobalAideEntry from "./index.js";

describe("isCanonicalGlobalAideEntry", () => {
	it.each([
		["bare name", { command: "aidemd-mcp", args: [] }],
		["cmd /c bare name", { command: "cmd", args: ["/c", "aidemd-mcp"] }],
		[
			"cmd /c absolute .cmd shim",
			{ command: "cmd", args: ["/c", "C:\\Users\\x\\AppData\\Roaming\\npm\\aidemd-mcp.cmd"] },
		],
		["POSIX absolute path", { command: "/usr/local/bin/aidemd-mcp", args: [] }],
		["uppercase .CMD", { command: "cmd", args: ["/c", "AIDEMD-MCP.CMD"] }],
	])("accepts %s", (_label, entry) => {
		expect(isCanonicalGlobalAideEntry(entry)).toBe(true);
	});

	it.each([
		["wrong package", { command: "mcpvault", args: [] }],
		["extra args on direct launch", { command: "aidemd-mcp", args: ["--root", "x"] }],
		["extra args on cmd /c launch", { command: "cmd", args: ["/c", "aidemd-mcp", "--root", "x"] }],
		["npx", { command: "npx", args: ["-y", "@aidemd-mcp/server@1.0.0"] }],
		["node", { command: "node", args: ["dist/index.js"] }],
		["missing args", { command: "aidemd-mcp", args: undefined }],
		["non-string command", { command: 42, args: [] }],
		["null command", { command: null, args: null }],
	])("rejects %s", (_label, entry) => {
		expect(isCanonicalGlobalAideEntry(entry)).toBe(false);
	});
});
