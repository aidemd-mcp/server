import { describe, it, expect } from "vitest";
import readAidePin from "./index.js";

describe("readAidePin", () => {
	it("locates the pin in a direct npx entry", () => {
		expect(readAidePin({ command: "npx", args: ["-y", "@aidemd-mcp/server@0.12.0"] })).toEqual({
			argsStart: 0,
			specIndex: 1,
			packageName: "@aidemd-mcp/server",
			version: "0.12.0",
			autoConfirm: true,
		});
	});

	it("locates the pin in the cmd /c npx form", () => {
		expect(readAidePin({ command: "cmd", args: ["/c", "npx", "-y", "@aidemd-mcp/server@0.12.0"] })).toMatchObject({
			argsStart: 2,
			specIndex: 3,
			version: "0.12.0",
		});
	});

	it("reports a missing version as null and a tag as its text", () => {
		expect(readAidePin({ command: "npx", args: ["-y", "@aidemd-mcp/server"] })?.version).toBeNull();
		expect(readAidePin({ command: "npx", args: ["-y", "@aidemd-mcp/server@latest"] })?.version).toBe("latest");
	});

	it.each([
		["null", null],
		["a string", "npx"],
		["a non-string command", { command: 42, args: [] }],
		["non-array args", { command: "npx", args: "x" }],
		["args with a non-string", { command: "npx", args: ["-y", 7, "@aidemd-mcp/server@0.12.0"] }],
		["the legacy package", { command: "npx", args: ["-y", "aidemd-mcp"] }],
		["another scoped package", { command: "npx", args: ["-y", "@other/pkg@1.0.0"] }],
		["a -p package flag", { command: "npx", args: ["-p", "@aidemd-mcp/server@0.12.0", "aidemd-mcp"] }],
		["a global entry", { command: "aidemd-mcp", args: [] }],
	])("returns null for %s", (_label, entry) => {
		expect(readAidePin(entry)).toBeNull();
	});
});
