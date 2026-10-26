import { describe, it, expect } from "vitest";
import locatePinToken from "./index.js";

const SPEC = "@aidemd-mcp/server@0.12.0";

function makeRaw({ indent = "  ", eol = "\n", before = false } = {}): string {
	const other = { command: "npx", args: ["-y", SPEC] };
	const aide = { command: "npx", args: ["-y", SPEC] };
	const servers = before ? { other, aide } : { aide, other };
	return JSON.stringify({ mcpServers: servers }, null, indent).replace(/\n/g, eol);
}

describe("locatePinToken", () => {
	it.each([
		["2-space LF", makeRaw()],
		["tab CRLF", makeRaw({ indent: "\t", eol: "\r\n" })],
		["minified", JSON.stringify({ mcpServers: { aide: { command: "npx", args: ["-y", SPEC] } } })],
	])("locates the token in %s", (_name, raw) => {
		const token = locatePinToken({ raw, specIndex: 1 });
		expect(token).not.toBeNull();
		expect(raw.slice(token!.start, token!.end)).toBe(`"${SPEC}"`);
		expect(token!.value).toBe(SPEC);
	});

	it("stays inside the aide entry when another server listed before it has the same spec", () => {
		const raw = makeRaw({ before: true });
		const token = locatePinToken({ raw, specIndex: 1 });
		expect(token!.start).toBeGreaterThan(raw.indexOf('"aide"'));
	});

	it.each([
		["duplicate aide key", `{"mcpServers":{"aide":{"args":["-y","${SPEC}"]},"aide":{"args":["-y","${SPEC}"]}}}`, 1],
		["invalid JSON", `{"mcpServers": `, 1],
		["specIndex past the end", makeRaw(), 9],
		["mcpServers missing", `{"other":{}}`, 1],
		["arg is a number", `{"mcpServers":{"aide":{"args":["-y",5]}}}`, 1],
	])("returns null for %s", (_name, raw, specIndex) => {
		expect(locatePinToken({ raw, specIndex })).toBeNull();
	});
});
