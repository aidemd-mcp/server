import { describe, it, expect } from "vitest";
import isAideHookCommand from "./index.js";

describe("isAideHookCommand", () => {
	it.each([
		"aidemd-mcp hook",
		"aidemd-mcp.cmd hook",
		"aidemd-mcp.exe hook",
		"aidemd-mcp.ps1 hook",
		"C:\\Users\\me\\AppData\\Roaming\\npm\\aidemd-mcp.cmd hook",
		"/usr/local/bin/aidemd-mcp hook",
		"npx -y @aidemd-mcp/server@0.18.0 hook",
		"npx @aidemd-mcp/server hook",
		"npx.cmd --yes -q @aidemd-mcp/server@latest hook",
		"cmd /c npx -y @aidemd-mcp/server hook",
		"CMD.EXE /C aidemd-mcp hook",
		"node \"C:/Users/me/AppData/Roaming/npm/node_modules/@aidemd-mcp/server/dist/index.js\" hook",
		"node \"C:\\Users\\me\\AppData\\Roaming\\npm\\node_modules\\@aidemd-mcp\\server\\dist\\index.js\" hook",
		"node.exe '/usr/lib/node_modules/@aidemd-mcp/server/dist/index.js' hook",
		"/usr/bin/node /usr/lib/node_modules/@aidemd-mcp/server/dist/index.js hook",
		"aidemd-mcp hook SessionEnd",
		"npx -y @aidemd-mcp/server hook Stop",
		"  aidemd-mcp   hook  ",
	])("recognizes %j", (command) => {
		expect(isAideHookCommand(command)).toBe(true);
	});

	it.each([
		"my-tool hook",
		"aidemd-mcp sync",
		"aidemd-mcp",
		"aidemd-mcp hook Notification",
		"aidemd-mcp hook SessionEnd extra",
		"node ./dist/index.js hook",
		"node \"C:/work/@aidemd-mcp/other/dist/index.js\" hook",
		"node a.js b.js hook",
		"npx other-pkg hook",
		"npx -y hook",
		"npx @aidemd-mcp/server-extra hook",
		"cmd /c my-tool hook",
		"hook",
		"",
		"   ",
	])("rejects %j", (command) => {
		expect(isAideHookCommand(command)).toBe(false);
	});
});
