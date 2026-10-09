import { describe, it, expect } from "vitest";
import describeAideCommand from "./index.js";

describe("describeAideCommand", () => {
	it("pins the exact phrase for sync", () => {
		expect(describeAideCommand("sync")).toBe(
			"`aidemd-mcp sync` when the project's `aide` MCP entry runs the globally installed `aidemd-mcp`, or `npx -y @aidemd-mcp/server@<version> sync` with the version that entry pins when it runs through npx",
		);
	});

	it("pins the exact phrase for init", () => {
		expect(describeAideCommand("init")).toBe(
			"`aidemd-mcp init` when the project's `aide` MCP entry runs the globally installed `aidemd-mcp`, or `npx -y @aidemd-mcp/server@<version> init` with the version that entry pins when it runs through npx",
		);
	});

	it.each(["sync", "init"] as const)("names both launchers for %s", (subcommand) => {
		const phrase = describeAideCommand(subcommand);
		expect(phrase).toContain(`aidemd-mcp ${subcommand}`);
		expect(phrase).toContain(`npx -y @aidemd-mcp/server@<version> ${subcommand}`);
	});

	it.each(["sync", "init"] as const)("never mentions @latest for %s", (subcommand) => {
		expect(describeAideCommand(subcommand)).not.toContain("@latest");
	});
});
