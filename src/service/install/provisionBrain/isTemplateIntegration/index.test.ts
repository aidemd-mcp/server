import { describe, it, expect } from "vitest";
import type { BrainAideMcpServerConfig } from "@/types/index.js";
import { MCPVAULT_VERSION } from "../obsidianBrainAideTemplate/index.js";
import isTemplateIntegration from "./index.js";

const PINNED = `@bitbonsai/mcpvault@${MCPVAULT_VERSION}`;

describe("isTemplateIntegration", () => {
	it.each([
		["the template's local POSIX launcher", { command: "npx", args: ["-y", PINNED, "/home/u/vault"] }],
		["the template's local win32 cmd /c npx launcher", { command: "cmd", args: ["/c", "npx", "-y", PINNED, "C:\\vault"] }],
		["global mcpvault", { command: "mcpvault", args: ["/home/u/vault"] }],
		["cmd /c mcpvault", { command: "cmd", args: ["/c", "mcpvault", "C:\\vault"] }],
		["an absolute-path mcpvault.cmd", { command: "C:\\Users\\u\\AppData\\Roaming\\npm\\mcpvault.cmd", args: ["C:\\vault"] }],
		["an unpinned npx @bitbonsai/mcpvault (legacy)", { command: "npx", args: ["@bitbonsai/mcpvault", "/home/u/vault"] }],
		["the null-path-slot scaffold", { command: "npx", args: ["-y", PINNED, null] }],
		["the win32 null-path-slot scaffold", { command: "cmd", args: ["/c", "npx", "-y", PINNED, null] }],
	] satisfies [string, BrainAideMcpServerConfig][])("is true for %s", (_label, config) => {
		expect(isTemplateIntegration(config)).toBe(true);
	});

	it.each([
		["npx running another package", { command: "npx", args: ["-y", "some-other-mcp@1.0.0", "/vault"] }],
		["a different program", { command: "node", args: ["server.js", "@bitbonsai/mcpvault"] }],
		["npx with no args", { command: "npx", args: [] }],
		["npx with only a null slot", { command: "npx", args: [null] }],
		["a package that merely shares the prefix", { command: "npx", args: ["@bitbonsai/mcpvault-fork@1.0.0"] }],
	] satisfies [string, BrainAideMcpServerConfig][])("is false for %s", (_label, config) => {
		expect(isTemplateIntegration(config)).toBe(false);
	});

	it("never reads the frontmatter name: an obsidian-named config on another launcher is judged by its launcher alone", () => {
		// The function takes only the launcher config, so a `name: obsidian` cannot influence the verdict.
		const obsidianNamedOtherLauncher: BrainAideMcpServerConfig = { command: "node", args: ["custom-server.js", null] };
		expect(isTemplateIntegration(obsidianNamedOtherLauncher)).toBe(false);
	});
});
