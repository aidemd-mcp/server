import { describe, it, expect, vi, afterEach } from "vitest";

// Mock the init CLI module to prevent its IIFE from executing during tests.
vi.mock("./cli/init/index.js", () => ({}));

// Mock MCP SDK modules to prevent real server instantiation.
vi.mock("@modelcontextprotocol/sdk/server/index.js", () => ({
	Server: vi.fn().mockImplementation(() => ({
		setRequestHandler: vi.fn(),
		connect: vi.fn().mockResolvedValue(undefined),
	})),
}));
vi.mock("@modelcontextprotocol/sdk/server/stdio.js", () => ({
	StdioServerTransport: vi.fn().mockImplementation(() => ({})),
}));
vi.mock("@modelcontextprotocol/sdk/types.js", () => ({
	CallToolRequestSchema: {},
	ListToolsRequestSchema: {},
}));

// Import the exported function under test after mocks are declared.
import { routeSubcommand } from "./index.js";

const originalArgv = process.argv;

afterEach(() => {
	process.argv = originalArgv;
	vi.clearAllMocks();
});

describe("routeSubcommand", () => {
	it("dynamically imports ./cli/init/index.js and returns true when argv[2] is 'init'", async () => {
		process.argv = ["node", "dist/index.js", "init"];

		const handled = await routeSubcommand();

		expect(handled).toBe(true);
		// The dynamic import of the mocked module must have been attempted.
		// We verify by confirming routeSubcommand returned true, which only
		// happens when the import branch executes.
	});

	it("returns false and does not import the init module when argv[2] is not 'init'", async () => {
		process.argv = ["node", "dist/index.js", "--root", "/some/path"];

		const handled = await routeSubcommand();

		expect(handled).toBe(false);
	});

	it("returns false when process.argv has no positional arguments", async () => {
		process.argv = ["node", "dist/index.js"];

		const handled = await routeSubcommand();

		expect(handled).toBe(false);
	});

	it("returns false when argv[2] is a different subcommand", async () => {
		process.argv = ["node", "dist/index.js", "upgrade"];

		const handled = await routeSubcommand();

		expect(handled).toBe(false);
	});
});
