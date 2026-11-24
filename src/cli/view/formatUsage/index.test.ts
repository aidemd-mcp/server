import { describe, expect, it } from "vitest";
import formatUsage from "./index.js";

describe("formatUsage", () => {
	const usage = formatUsage();

	it("names the command, the flags and the global launcher", () => {
		expect(usage).toContain("view [--port <n>]");
		expect(usage).toContain("AIDE_OBSERVER_PORT");
		expect(usage).toContain("--brain <path>");
		expect(usage).toContain("aidemd-mcp view");
	});

	it("never contains the @latest launcher", () => {
		expect(usage).not.toContain("@aidemd-mcp/server" + "@latest");
	});
});
