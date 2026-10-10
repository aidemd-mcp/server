import { describe, it, expect } from "vitest";
import type { BrainAideMcpServerConfig, LaunchMode } from "@/types/index.js";
import { parseBrainAideFromString } from "@/service/parseBrainAide/index.js";
import obsidianBrainAideTemplate, { MCPVAULT_VERSION } from "../../obsidianBrainAideTemplate/index.js";
import findLegacyLauncher from "./index.js";

const PINNED = `@bitbonsai/mcpvault@${MCPVAULT_VERSION}`;

function templateLauncher(mode: LaunchMode): BrainAideMcpServerConfig {
	const parsed = parseBrainAideFromString(obsidianBrainAideTemplate(mode));
	if (parsed.kind !== "ok" && parsed.kind !== "missing-sections") throw new Error(`template parsed as ${parsed.kind}`);
	return parsed.mcpServerConfig;
}

describe("findLegacyLauncher", () => {
	it("flags the win32 legacy form as unpinned and missing -y, with local and global rewrites", () => {
		const offer = findLegacyLauncher({ command: "cmd", args: ["/c", "npx", "@bitbonsai/mcpvault", "C:\\vault"] });
		expect(offer?.reasons).toEqual(["unpinned", "missing-auto-confirm"]);
		expect(offer?.after.local).toEqual({ command: "cmd", args: ["/c", "npx", "-y", PINNED, "C:\\vault"] });
		expect(offer?.after.global).toEqual({ command: "mcpvault", args: ["C:\\vault"] });
	});

	it("flags the POSIX legacy form as unpinned and missing -y", () => {
		const offer = findLegacyLauncher({ command: "npx", args: ["@bitbonsai/mcpvault", "/home/u/vault"] });
		expect(offer?.reasons).toEqual(["unpinned", "missing-auto-confirm"]);
		expect(offer?.after.local).toEqual({ command: "npx", args: ["-y", PINNED, "/home/u/vault"] });
		expect(offer?.after.global).toEqual({ command: "mcpvault", args: ["/home/u/vault"] });
	});

	it("flags @latest as unversioned when -y is present", () => {
		const offer = findLegacyLauncher({ command: "npx", args: ["-y", "@bitbonsai/mcpvault@latest", "/v"] });
		expect(offer?.reasons).toEqual(["unversioned"]);
		expect(offer?.after.local.args).toEqual(["-y", PINNED, "/v"]);
	});

	it("flags an older exact pin with -y as older-pin", () => {
		const offer = findLegacyLauncher({ command: "npx", args: ["-y", "@bitbonsai/mcpvault@0.15.0", "/v"] });
		expect(offer?.reasons).toEqual(["older-pin"]);
		expect(offer?.after.local.args).toEqual(["-y", PINNED, "/v"]);
	});

	it("flags a newer pin without -y only as missing-auto-confirm and keeps the pin", () => {
		const offer = findLegacyLauncher({ command: "npx", args: ["@bitbonsai/mcpvault@0.17.0", "/v"] });
		expect(offer?.reasons).toEqual(["missing-auto-confirm"]);
		expect(offer?.after.local.args).toEqual(["-y", "@bitbonsai/mcpvault@0.17.0", "/v"]);
	});

	it("flags a missing -y on the current pin", () => {
		const offer = findLegacyLauncher({ command: "npx", args: [PINNED, "/v"] });
		expect(offer?.reasons).toEqual(["missing-auto-confirm"]);
	});

	it("does not flag the current pin with -y", () => {
		expect(findLegacyLauncher({ command: "npx", args: ["-y", PINNED, "/v"] })).toBeNull();
	});

	it.each([
		["the global launcher by name", { command: "mcpvault", args: ["/v"] }],
		["the global launcher by absolute path", { command: "C:\\npm\\mcpvault.cmd", args: ["C:\\vault"] }],
		["npx running another package", { command: "npx", args: ["-y", "some-other-mcp", "/v"] }],
		["uvx", { command: "uvx", args: ["something"] }],
		["cmd /c node", { command: "cmd", args: ["/c", "node", "server.js"] }],
		["npx with --package", { command: "npx", args: ["--package", "@bitbonsai/mcpvault", "tool"] }],
	])("never flags a custom launcher: %s", (_name, config) => {
		expect(findLegacyLauncher(config)).toBeNull();
	});

	it("keeps null args at their relative position in local and global", () => {
		const offer = findLegacyLauncher({ command: "npx", args: ["@bitbonsai/mcpvault", null, "/v", null] });
		expect(offer?.after.local.args).toEqual(["-y", PINNED, null, "/v", null]);
		expect(offer?.after.global.args).toEqual([null, "/v", null]);
	});

	it("returns the input config as before", () => {
		const config = { command: "cmd", args: ["/c", "npx", "@bitbonsai/mcpvault", null] };
		expect(findLegacyLauncher(config)?.before).toEqual(config);
	});

	it("does not mutate the input args", () => {
		const args = ["@bitbonsai/mcpvault", "/v"];
		findLegacyLauncher({ command: "npx", args });
		expect(args).toEqual(["@bitbonsai/mcpvault", "/v"]);
	});

	it.each<LaunchMode>(["local", "global"])("does not flag the template's own %s launcher", (mode) => {
		expect(findLegacyLauncher(templateLauncher(mode))).toBeNull();
	});
});
