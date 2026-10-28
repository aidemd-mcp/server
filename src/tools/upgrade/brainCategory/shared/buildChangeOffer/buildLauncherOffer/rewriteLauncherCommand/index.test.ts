import { describe, it, expect } from "vitest";
import rewriteLauncherCommand from "./index.js";

const region = (command: string, eol = "\n") =>
	["name: obsidian", "mcpServerConfig:", `  command: ${command}`, "  args:", "    - 'x'", ""].join(eol);

describe("rewriteLauncherCommand", () => {
	it("replaces a plain command with a plain one, touching no other byte", () => {
		expect(rewriteLauncherCommand({ frontmatter: region("npx"), before: "npx", after: "mcpvault" })).toBe(region("mcpvault"));
	});

	it("replaces a quoted original", () => {
		expect(rewriteLauncherCommand({ frontmatter: region("'cmd'"), before: "cmd", after: "mcpvault" })).toBe(region("mcpvault"));
		expect(rewriteLauncherCommand({ frontmatter: region('"cmd"'), before: "cmd", after: "mcpvault" })).toBe(region("mcpvault"));
	});

	it("keeps CRLF line endings and a trailing comment", () => {
		const crlf = region("npx   # launcher", "\r\n");
		expect(rewriteLauncherCommand({ frontmatter: crlf, before: "npx", after: "mcpvault" })).toBe(region("mcpvault   # launcher", "\r\n"));
	});

	it("single-quotes a replacement that is not plain-safe, doubling quotes", () => {
		expect(rewriteLauncherCommand({ frontmatter: region("npx"), before: "npx", after: "my tool's" })).toBe(region("'my tool''s'"));
	});

	it("returns null when the value does not equal before", () => {
		expect(rewriteLauncherCommand({ frontmatter: region("npx"), before: "cmd", after: "mcpvault" })).toBeNull();
	});

	it("returns null for a multi-line scalar", () => {
		const folded = ["mcpServerConfig:", "  command: >-", "    npx", "  args: []", ""].join("\n");
		expect(rewriteLauncherCommand({ frontmatter: folded, before: "npx", after: "mcpvault" })).toBeNull();
		const plain = ["mcpServerConfig:", "  command: np", "    x", ""].join("\n");
		expect(rewriteLauncherCommand({ frontmatter: plain, before: "np x", after: "mcpvault" })).toBeNull();
	});

	it("returns null for a flow mapping or a missing command", () => {
		expect(rewriteLauncherCommand({ frontmatter: "mcpServerConfig: { command: npx }\n", before: "npx", after: "mcpvault" })).toBeNull();
		expect(rewriteLauncherCommand({ frontmatter: "mcpServerConfig:\n  args: []\n", before: "npx", after: "mcpvault" })).toBeNull();
	});
});
