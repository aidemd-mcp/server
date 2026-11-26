import { describe, expect, it } from "vitest";
import protocol from "@/service/observer/event/shared/protocol/index.js";
import formatUsage from "./index.js";

describe("formatUsage", () => {
	const usage = formatUsage();

	it("names the command, the flags and the global launcher", () => {
		expect(usage).toContain("view [--port <n>]");
		expect(usage).toContain("AIDE_OBSERVER_PORT");
		expect(usage).toContain("--kanban <path>");
		expect(usage).toContain("--brain <path> is deprecated and means --kanban <path>/kanban.");
		expect(usage).toContain("aidemd-mcp view");
	});

	it("builds the port range from protocol.ports and no longer names a default port", () => {
		const first = protocol.ports[0];
		const last = protocol.ports[protocol.ports.length - 1];
		expect(usage).toContain(`--port <n> is tried first, else ${protocol.portEnvVar}, then ports ${first} to ${last}`);
		expect(usage).not.toContain("default 24680");
		expect(usage).not.toContain("the default");
	});

	it("states the exit codes for an exhausted port list and a bad port value", () => {
		expect(usage).toContain(
			"Exit codes: 0 stopped or already running, 1 not started (no port could be bound, or a bad port value) or not replaced, 2 usage.",
		);
	});

	it("never contains the @latest launcher", () => {
		expect(usage).not.toContain("@aidemd-mcp/server" + "@latest");
	});
});
