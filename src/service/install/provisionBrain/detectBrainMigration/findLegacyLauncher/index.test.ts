import { describe, it, expect } from "vitest";
import type { BrainAideMcpServerConfig } from "@/types/index.js";
import { parseBrainAideFromString } from "@/service/parseBrainAide/index.js";
import obsidianBrainAideTemplate, { MCPVAULT_VERSION } from "../../obsidianBrainAideTemplate/index.js";
import findLegacyLauncher from "./index.js";

const PINNED = `@bitbonsai/mcpvault@${MCPVAULT_VERSION}`;

type Form = { name: string; build: (npxArgs: Array<string | null>) => BrainAideMcpServerConfig };

const FORMS: Form[] = [
	{ name: "POSIX", build: (npxArgs) => ({ command: "npx", args: npxArgs }) },
	{ name: "Win32", build: (npxArgs) => ({ command: "cmd", args: ["/c", "npx", ...npxArgs] }) },
];

function templateLauncher(): BrainAideMcpServerConfig {
	const parsed = parseBrainAideFromString(obsidianBrainAideTemplate());
	if (parsed.kind !== "ok" && parsed.kind !== "missing-sections") throw new Error(`template parsed as ${parsed.kind}`);
	return parsed.mcpServerConfig;
}

describe.each(FORMS)("findLegacyLauncher — $name npx form", ({ build }) => {
	it.each([
		["a string path", "/vault"],
		["a null path slot", null],
	])("flags the current pin with -y as npx-launch only and carries %s", (_name, slot) => {
		const offer = findLegacyLauncher(build(["-y", PINNED, slot]));
		expect(offer?.reasons).toEqual(["npx-launch"]);
		expect(offer?.after).toEqual({ command: "mcpvault", args: [slot] });
	});

	it.each([
		["unpinned with -y", ["-y", "@bitbonsai/mcpvault", "/v"], ["npx-launch", "unpinned"]],
		["@latest with -y", ["-y", "@bitbonsai/mcpvault@latest", "/v"], ["npx-launch", "unversioned"]],
		["an older pin with -y", ["-y", "@bitbonsai/mcpvault@0.15.0", "/v"], ["npx-launch", "older-pin"]],
		["the current pin without -y", [PINNED, "/v"], ["npx-launch", "missing-auto-confirm"]],
		["a newer pin without -y", ["@bitbonsai/mcpvault@99.0.0", "/v"], ["npx-launch", "missing-auto-confirm"]],
		["unpinned without -y", ["@bitbonsai/mcpvault", "/v"], ["npx-launch", "unpinned", "missing-auto-confirm"]],
	])("puts npx-launch first, then the pin reasons in order: %s", (_name, npxArgs, reasons) => {
		const offer = findLegacyLauncher(build(npxArgs));
		expect(offer?.reasons).toEqual(reasons);
		expect(offer?.after).toEqual({ command: "mcpvault", args: ["/v"] });
	});

	it("carries every arg after the spec, in order", () => {
		const offer = findLegacyLauncher(build(["-y", PINNED, "--rootDir", "/v"]));
		expect(offer?.after).toEqual({ command: "mcpvault", args: ["--rootDir", "/v"] });
	});

	it("keeps null args at their relative position", () => {
		const offer = findLegacyLauncher(build(["@bitbonsai/mcpvault", null, "/v", null]));
		expect(offer?.after.args).toEqual([null, "/v", null]);
	});

	it("returns the input config as before", () => {
		const config = build(["-y", PINNED, null]);
		expect(findLegacyLauncher(config)?.before).toEqual(config);
	});

	it("does not mutate the input args", () => {
		const args = ["@bitbonsai/mcpvault", "/v"];
		findLegacyLauncher(build(args));
		expect(args).toEqual(["@bitbonsai/mcpvault", "/v"]);
	});
});

describe("findLegacyLauncher — launchers that are never flagged", () => {
	it.each([
		["the global launcher by name", { command: "mcpvault", args: ["/v"] }],
		["the global launcher by absolute path", { command: "C:\\npm\\mcpvault.cmd", args: ["C:\\vault"] }],
		["npx running another package", { command: "npx", args: ["-y", "some-other-mcp", "/v"] }],
		["win32 npx running another package", { command: "cmd", args: ["/c", "npx", "-y", "some-other-mcp", "/v"] }],
		["uvx", { command: "uvx", args: ["something"] }],
		["cmd /c node", { command: "cmd", args: ["/c", "node", "server.js"] }],
		["npx with --package", { command: "npx", args: ["--package", "@bitbonsai/mcpvault", "tool"] }],
		["npx with -p", { command: "npx", args: ["-p", "@bitbonsai/mcpvault", "tool"] }],
	])("never flags %s", (_name, config) => {
		expect(findLegacyLauncher(config)).toBeNull();
	});

	it("does not flag the template's own launcher", () => {
		expect(findLegacyLauncher(templateLauncher())).toBeNull();
	});
});
