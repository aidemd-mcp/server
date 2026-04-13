import { describe, it, expect, vi, beforeEach } from "vitest";
import { runInit } from "./index.js";

vi.mock("./writeMcpEntry/index.js");
vi.mock("./writeInitCommand/index.js");

import writeMcpEntry from "./writeMcpEntry/index.js";
import writeInitCommand from "./writeInitCommand/index.js";

const mockWriteMcpEntry = vi.mocked(writeMcpEntry);
const mockWriteInitCommand = vi.mocked(writeInitCommand);

beforeEach(() => {
	vi.clearAllMocks();
});

describe("runInit", () => {
	it("prints two [created] lines and the Done closing message when both artifacts are created", async () => {
		mockWriteMcpEntry.mockResolvedValue({
			status: "created",
			message: "aide MCP server entry",
		});
		mockWriteInitCommand.mockResolvedValue({
			status: "created",
			message: "/aide:init command",
		});

		const lines: string[] = [];
		const exitCode = await runInit("/fake/cwd", (line) => lines.push(line));

		expect(lines[0]).toBe("[created] .mcp.json — aide MCP server entry");
		expect(lines[1]).toBe(
			"[created] .claude/commands/aide/init.md — /aide:init command",
		);
		expect(lines[2]).toBe(
			"Done. Open Claude Code and run /aide:init to complete setup.",
		);
		expect(exitCode).toBe(0);
	});

	it("prints two [exists] lines and the Already set up closing message when both artifacts exist", async () => {
		mockWriteMcpEntry.mockResolvedValue({
			status: "exists",
			message: "aide server already configured",
		});
		mockWriteInitCommand.mockResolvedValue({
			status: "exists",
			message: "/aide:init command already present",
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

		const lines: string[] = [];
		const exitCode = await runInit("/fake/cwd", (line) => lines.push(line));

		expect(lines[0]).toBe("[created] .mcp.json — aide MCP server entry");
		expect(lines[1]).toBe(
			"[exists] .claude/commands/aide/init.md — /aide:init command already present",
		);
		expect(lines[2]).toBe(
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

		const lines: string[] = [];
		const exitCode = await runInit("/fake/cwd", (line) => lines.push(line));

		expect(lines[0]).toBe(
			"[exists] .mcp.json — aide server already configured",
		);
		expect(lines[1]).toBe(
			"[created] .claude/commands/aide/init.md — /aide:init command",
		);
		expect(lines[2]).toBe(
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

		const lines: string[] = [];
		await expect(
			runInit("/fake/cwd", (line) => lines.push(line)),
		).rejects.toThrow("Failed to write init command file.");
	});
});
