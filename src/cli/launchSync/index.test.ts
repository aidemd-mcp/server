import { describe, it, expect, vi, beforeEach, afterEach, type MockInstance } from "vitest";

const { mockRunSync } = vi.hoisted(() => ({ mockRunSync: vi.fn() }));
vi.mock("@/cli/sync/index.js", () => ({ runSync: mockRunSync }));

import launchSync from "./index.js";
import aidePackage from "@/service/install/shared/aidePackage/index.js";

const originalArgv = process.argv;

// The help text exactly as written in src/index.ts routeSubcommand at the time of the move.
const EXPECTED_HELP =
	`Usage: ${aidePackage.command} sync (global)\n` +
	`       npx -y ${aidePackage.name}@<version> sync (local)\n\n` +
	"Reads `.aide/config/brain.aide` from the current project root, derives the brain\n" +
	"MCP server entry by interpolating the configured brain root path into the\n" +
	"mcpServerConfig.args template, and writes the result into `.mcp.json` under\n" +
	"the fixed `brain` key. Every other key in `mcpServers` (including any `aide`\n" +
	"entry, personal MCP integrations, etc.) is left byte-identical. If an\n" +
	"obsolete `obsidian` key is present it is removed in the same write.\n\n" +
	"Sync is idempotent — running it twice in succession produces the same\n" +
	"`.mcp.json` bytes, and the second invocation prints 'already in sync'.\n\n" +
	"Run sync after editing `.aide/config/brain.aide` to propagate your changes:\n" +
	`  ${aidePackage.command} sync (global)\n` +
	`  npx -y ${aidePackage.name}@<version> sync (local)\n\n` +
	"Sync accepts no flags other than --help. Both paths are conventional:\n" +
	"  brain.aide  →  <cwd>/.aide/config/brain.aide\n" +
	"  mcp config  →  <cwd>/.mcp.json\n";

let exitSpy: MockInstance;
let stdoutSpy: MockInstance;
let stderrSpy: MockInstance;

beforeEach(() => {
	exitSpy = vi.spyOn(process, "exit").mockImplementation((() => undefined) as never);
	stdoutSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
	stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
});

afterEach(() => {
	process.argv = originalArgv;
	vi.restoreAllMocks();
	mockRunSync.mockReset();
});

describe("launchSync", () => {
	it("prints help and exits 2 without running sync when --help is in argv", async () => {
		process.argv = ["node", "aide", "sync", "--help"];
		// A real process.exit never returns; throw so the flow stops as it would.
		exitSpy.mockImplementation((() => {
			throw new Error("exit");
		}) as never);

		await expect(launchSync()).rejects.toThrow("exit");

		const written = stdoutSpy.mock.calls.map((c) => String(c[0])).join("");
		expect(written.startsWith("Usage: ")).toBe(true);
		expect(exitSpy).toHaveBeenCalledWith(2);
		expect(mockRunSync).not.toHaveBeenCalled();
	});

	it("prints help text identical to the one in src/index.ts at the time of the move", async () => {
		process.argv = ["node", "aide", "sync", "--help"];
		exitSpy.mockImplementation((() => {
			throw new Error("exit");
		}) as never);

		await expect(launchSync()).rejects.toThrow("exit");

		expect(stdoutSpy).toHaveBeenCalledWith(EXPECTED_HELP);
	});

	it("exits 0 with the cwd passed to runSync when runSync resolves 0", async () => {
		process.argv = ["node", "aide", "sync"];
		mockRunSync.mockResolvedValue(0);

		await launchSync();

		expect(mockRunSync).toHaveBeenCalledWith(process.cwd());
		expect(exitSpy).toHaveBeenCalledWith(0);
	});

	it("exits 1 when runSync resolves 1", async () => {
		process.argv = ["node", "aide", "sync"];
		mockRunSync.mockResolvedValue(1);

		await launchSync();

		expect(exitSpy).toHaveBeenCalledWith(1);
	});

	it("writes 'Error: <message>' to stderr and exits 1 when runSync throws", async () => {
		process.argv = ["node", "aide", "sync"];
		mockRunSync.mockRejectedValue(new Error("boom"));

		await launchSync();

		expect(stderrSpy).toHaveBeenCalledWith("Error: boom\n");
		expect(exitSpy).toHaveBeenCalledWith(1);
	});
});
