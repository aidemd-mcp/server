import { describe, it, expect } from "vitest";
import detectLaunchMode from "./index.js";

describe("detectLaunchMode", () => {
	it.each([
		["npx", []],
		["NPX", []],
		["npx.cmd", []],
		["/usr/bin/npx", []],
		["cmd", ["/c", "npx", "@aidemd-mcp/server"]],
		["cmd", ["/c", "npx", "-y", "@aidemd-mcp/server@latest"]],
		["npx", ["-y", "@aidemd-mcp/server@0.9.0"]],
	])("is local for %s %j", (command, args) => {
		expect(detectLaunchMode({ command, args })).toBe("local");
	});

	it.each([
		["aidemd-mcp", []],
		["cmd", ["/c", "aidemd-mcp"]],
		["cmd", ["/c", "C:\\Users\\x\\AppData\\Roaming\\npm\\aidemd-mcp.cmd"]],
		["node", ["dist/index.js"]],
	])("is global for %s %j", (command, args) => {
		expect(detectLaunchMode({ command, args })).toBe("global");
	});

	it.each([
		[{ command: undefined, args: undefined }],
		[{ command: 7, args: [] }],
		[{ command: "cmd", args: undefined }],
		[{ command: "cmd", args: ["/c", 1] }],
	])("is global without throwing for malformed %j", (entry) => {
		expect(detectLaunchMode(entry)).toBe("global");
	});
});
