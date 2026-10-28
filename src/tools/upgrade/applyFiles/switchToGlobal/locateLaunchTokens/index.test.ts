import { describe, it, expect } from "vitest";
import locateLaunchTokens from "./index.js";

const SPEC = "@aidemd-mcp/server@0.12.0";

function makeRaw({ indent = "  ", eol = "\n" } = {}): string {
	const other = { command: "npx", args: ["-y", SPEC] };
	const aide = { command: "npx", args: ["-y", SPEC] };
	return JSON.stringify({ mcpServers: { other, aide } }, null, indent).replace(/\n/g, eol);
}

describe("locateLaunchTokens", () => {
	it.each([
		["2-space LF", makeRaw()],
		["tab CRLF", makeRaw({ indent: "\t", eol: "\r\n" })],
		["minified", JSON.stringify({ mcpServers: { aide: { command: "npx", args: ["-y", SPEC] } } })],
	])("locates command and args in %s", (_name, raw) => {
		const tokens = locateLaunchTokens({ raw, key: "aide" });
		expect(tokens).not.toBeNull();
		expect(raw.slice(tokens!.command.start, tokens!.command.end)).toBe('"npx"');
		expect(raw.slice(tokens!.args.start, tokens!.args.end)).toMatch(/^\[[\s\S]*\]$/);
		expect(raw.slice(tokens!.args.start, tokens!.args.end)).toContain(SPEC);
		expect(tokens!.command.start).toBeGreaterThan(raw.indexOf('"aide"'));
	});

	it("locates a multi-line args array through its closing bracket", () => {
		const raw = '{"mcpServers":{"aide":{"args":[\n  "-y",\n  "x"\n],"command":"npx"}}}';
		const tokens = locateLaunchTokens({ raw, key: "aide" });
		expect(raw.slice(tokens!.args.start, tokens!.args.end)).toBe('[\n  "-y",\n  "x"\n]');
		expect(raw.slice(tokens!.command.start, tokens!.command.end)).toBe('"npx"');
	});

	it("locates the aidemd-mcp key", () => {
		const raw = JSON.stringify({ mcpServers: { "aidemd-mcp": { command: "npx", args: ["-y", SPEC] } } });
		expect(locateLaunchTokens({ raw, key: "aidemd-mcp" })).not.toBeNull();
	});

	it.each([
		["duplicate aide key", `{"mcpServers":{"aide":{"command":"npx","args":[]},"aide":{"command":"npx","args":[]}}}`],
		["invalid JSON", `{"mcpServers": `],
		["mcpServers missing", `{"other":{}}`],
		["entry missing", `{"mcpServers":{"brain":{"command":"npx","args":[]}}}`],
		["command is a number", `{"mcpServers":{"aide":{"command":5,"args":[]}}}`],
		["command is missing", `{"mcpServers":{"aide":{"args":[]}}}`],
		["args missing", `{"mcpServers":{"aide":{"command":"npx"}}}`],
		["args is a string", `{"mcpServers":{"aide":{"command":"npx","args":"x"}}}`],
	])("returns null for %s", (_name, raw) => {
		expect(locateLaunchTokens({ raw, key: "aide" })).toBeNull();
	});
});
