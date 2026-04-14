import { describe, it, expect, vi, beforeEach } from "vitest";

// Intercept process.exit before the module loads so the IIFE's process.exit
// calls are no-ops. vi.hoisted runs before vi.mock hoisting and before any
// module imports resolve, ensuring the spy is in place when the IIFE executes.
const { mockExit } = vi.hoisted(() => {
	const mockExit = vi.fn();
	process.exit = mockExit as unknown as typeof process.exit;
	return { mockExit };
});

vi.mock("./writeMcpEntry/index.js", () => ({
	default: vi.fn().mockResolvedValue({ status: "created", message: "aide MCP server entry" }),
}));
vi.mock("./writeInitCommand/index.js", () => ({
	default: vi.fn().mockResolvedValue({ status: "created", message: "/aide:init command" }),
}));
vi.mock("./writeAideTree/index.js", () => ({
	default: vi.fn().mockResolvedValue({ status: "created", message: "aide-tree launcher" }),
}));

import { runInit } from "./index.js";
import writeMcpEntry from "./writeMcpEntry/index.js";
import writeInitCommand from "./writeInitCommand/index.js";
import writeAideTree from "./writeAideTree/index.js";

const mockWriteMcpEntry = vi.mocked(writeMcpEntry);
const mockWriteInitCommand = vi.mocked(writeInitCommand);
const mockWriteAideTree = vi.mocked(writeAideTree);

beforeEach(() => {
	vi.clearAllMocks();
	// Re-apply default resolved values after clearAllMocks resets implementations.
	mockWriteMcpEntry.mockResolvedValue({ status: "created", message: "aide MCP server entry" });
	mockWriteInitCommand.mockResolvedValue({ status: "created", message: "/aide:init command" });
	mockWriteAideTree.mockResolvedValue({ status: "created", message: "aide-tree launcher" });
});

describe("runInit", () => {
	it("prints three [created] lines and the Done closing message when all artifacts are created", async () => {
		mockWriteMcpEntry.mockResolvedValue({
			status: "created",
			message: "aide MCP server entry",
		});
		mockWriteInitCommand.mockResolvedValue({
			status: "created",
			message: "/aide:init command",
		});
		mockWriteAideTree.mockResolvedValue({
			status: "created",
			message: "aide-tree launcher",
		});

		const lines: string[] = [];
		const exitCode = await runInit("/fake/cwd", (line) => lines.push(line));

		expect(lines[0]).toBe("[created] .mcp.json — aide MCP server entry");
		expect(lines[1]).toBe(
			"[created] .claude/commands/aide/init.md — /aide:init command",
		);
		expect(lines[2]).toBe(
			"[created] .aide/bin/aide-tree.mjs — aide-tree launcher",
		);
		expect(lines[3]).toBe(
			"Done. Open Claude Code and run /aide:init to complete setup.",
		);
		expect(exitCode).toBe(0);
	});

	it("prints three [exists] lines and the Already set up closing message when all artifacts exist", async () => {
		mockWriteMcpEntry.mockResolvedValue({
			status: "exists",
			message: "aide server already configured",
		});
		mockWriteInitCommand.mockResolvedValue({
			status: "exists",
			message: "/aide:init command already present",
		});
		mockWriteAideTree.mockResolvedValue({
			status: "exists",
			message: "aide-tree launcher already present",
		});

		const lines: string[] = [];
		const exitCode = await runInit("/fake/cwd", (line) => lines.push(line));

		expect(lines[0]).toBe(
			"[exists] .mcp.json — aide server already configured",
		);
		expect(lines[1]).toBe(
			"[exists] .claude/commands/aide/init.md — /aide:init command already present",
		);
		expect(lines[2]).toBe(
			"[exists] .aide/bin/aide-tree.mjs — aide-tree launcher already present",
		);
		expect(lines[3]).toBe(
			"Already set up. Run /aide:init in Claude Code to continue.",
		);
		expect(exitCode).toBe(0);
	});

	it("prints correct status per artifact when mcp is created and command exists", async () => {
		mockWriteMcpEntry.mockResolvedValue({
			status: "created",
			message: "aide MCP server entry",
		});
		mockWriteInitCommand.mockResolvedValue({
			status: "exists",
			message: "/aide:init command already present",
		});
		mockWriteAideTree.mockResolvedValue({
			status: "created",
			message: "aide-tree launcher",
		});

		const lines: string[] = [];
		const exitCode = await runInit("/fake/cwd", (line) => lines.push(line));

		expect(lines[0]).toBe("[created] .mcp.json — aide MCP server entry");
		expect(lines[1]).toBe(
			"[exists] .claude/commands/aide/init.md — /aide:init command already present",
		);
		expect(lines[2]).toBe(
			"[created] .aide/bin/aide-tree.mjs — aide-tree launcher",
		);
		expect(lines[3]).toBe(
			"Done. Open Claude Code and run /aide:init to complete setup.",
		);
		expect(exitCode).toBe(0);
	});

	it("prints correct status per artifact when mcp exists and command is created", async () => {
		mockWriteMcpEntry.mockResolvedValue({
			status: "exists",
			message: "aide server already configured",
		});
		mockWriteInitCommand.mockResolvedValue({
			status: "created",
			message: "/aide:init command",
		});
		mockWriteAideTree.mockResolvedValue({
			status: "exists",
			message: "aide-tree launcher already present",
		});

		const lines: string[] = [];
		const exitCode = await runInit("/fake/cwd", (line) => lines.push(line));

		expect(lines[0]).toBe(
			"[exists] .mcp.json — aide server already configured",
		);
		expect(lines[1]).toBe(
			"[created] .claude/commands/aide/init.md — /aide:init command",
		);
		expect(lines[2]).toBe(
			"[exists] .aide/bin/aide-tree.mjs — aide-tree launcher already present",
		);
		expect(lines[3]).toBe(
			"Done. Open Claude Code and run /aide:init to complete setup.",
		);
		expect(exitCode).toBe(0);
	});

	it("prints Done (not Already set up) when only two of three artifacts exist", async () => {
		mockWriteMcpEntry.mockResolvedValue({
			status: "exists",
			message: "aide server already configured",
		});
		mockWriteInitCommand.mockResolvedValue({
			status: "exists",
			message: "/aide:init command already present",
		});
		mockWriteAideTree.mockResolvedValue({
			status: "created",
			message: "aide-tree launcher",
		});

		const lines: string[] = [];
		const exitCode = await runInit("/fake/cwd", (line) => lines.push(line));

		expect(lines[3]).toBe(
			"Done. Open Claude Code and run /aide:init to complete setup.",
		);
		expect(exitCode).toBe(0);
	});

	it("throws when writeMcpEntry throws, allowing the caller to write to stderr", async () => {
		mockWriteMcpEntry.mockRejectedValue(
			new Error(
				".mcp.json exists but contains invalid JSON. Fix the syntax error and re-run.",
			),
		);
		mockWriteInitCommand.mockResolvedValue({
			status: "created",
			message: "/aide:init command",
		});
		mockWriteAideTree.mockResolvedValue({
			status: "created",
			message: "aide-tree launcher",
		});

		const lines: string[] = [];
		await expect(
			runInit("/fake/cwd", (line) => lines.push(line)),
		).rejects.toThrow(
			".mcp.json exists but contains invalid JSON. Fix the syntax error and re-run.",
		);
	});

	it("throws when writeInitCommand throws, allowing the caller to write to stderr", async () => {
		mockWriteMcpEntry.mockResolvedValue({
			status: "created",
			message: "aide MCP server entry",
		});
		mockWriteInitCommand.mockRejectedValue(
			new Error("Failed to write init command file."),
		);
		mockWriteAideTree.mockResolvedValue({
			status: "created",
			message: "aide-tree launcher",
		});

		const lines: string[] = [];
		await expect(
			runInit("/fake/cwd", (line) => lines.push(line)),
		).rejects.toThrow("Failed to write init command file.");
	});
});
