import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

vi.mock("./askLaunchMode/index.js", () => ({ default: vi.fn() }));
vi.mock("./confirmGlobalInstall/index.js", () => ({ default: vi.fn() }));
vi.mock("./installGlobalPackage/index.js", () => ({ default: vi.fn() }));
vi.mock("@/service/install/shared/checkGlobalPackage/index.js", () => ({ default: vi.fn() }));

import askLaunchMode from "./askLaunchMode/index.js";
import confirmGlobalInstall from "./confirmGlobalInstall/index.js";
import installGlobalPackage from "./installGlobalPackage/index.js";
import checkGlobalPackage from "@/service/install/shared/checkGlobalPackage/index.js";
import aidePackage from "@/service/install/shared/aidePackage/index.js";
import resolveLaunchModes from "./index.js";

const mockAsk = askLaunchMode as unknown as ReturnType<typeof vi.fn>;
const mockConfirm = confirmGlobalInstall as unknown as ReturnType<typeof vi.fn>;
const mockInstall = installGlobalPackage as unknown as ReturnType<typeof vi.fn>;
const mockCheck = checkGlobalPackage as unknown as ReturnType<typeof vi.fn>;

const NO_TERMINAL_LINE = `aide MCP server: ${aidePackage.name} is not installed globally and there is no terminal to ask — using local launch (npx).`;
const DECLINED_LINE = "aide MCP server: global install declined — using local launch (npx).";
const FAILED_LINE = "aide MCP server: global install failed — using local launch (npx).";

let cwd: string;
let write: ReturnType<typeof vi.fn>;
const originalStdinTTY = process.stdin.isTTY;
const originalStdoutTTY = process.stdout.isTTY;

function setTTY(value: boolean): void {
	Object.defineProperty(process.stdin, "isTTY", { value, configurable: true });
	Object.defineProperty(process.stdout, "isTTY", { value, configurable: true });
}

beforeEach(async () => {
	vi.clearAllMocks();
	cwd = await mkdtemp(join(tmpdir(), "resolve-launch-modes-"));
	write = vi.fn();
});

afterEach(async () => {
	Object.defineProperty(process.stdin, "isTTY", { value: originalStdinTTY, configurable: true });
	Object.defineProperty(process.stdout, "isTTY", { value: originalStdoutTTY, configurable: true });
	await rm(cwd, { recursive: true, force: true });
});

describe("resolveLaunchModes", () => {
	it("resolves both servers local with no prompts when non-interactive and no flag", async () => {
		setTTY(false);
		const result = await resolveLaunchModes(cwd, undefined, write);
		expect(result).toEqual({ aide: "local", brain: "local" });
		expect(mockAsk).not.toHaveBeenCalled();
		expect(mockConfirm).not.toHaveBeenCalled();
		expect(write).not.toHaveBeenCalled();
	});

	it("honors --mode global non-interactively when the package is installed", async () => {
		setTTY(false);
		mockCheck.mockResolvedValue(true);
		const result = await resolveLaunchModes(cwd, "global", write);
		expect(result.aide).toBe("global");
		expect(mockAsk).not.toHaveBeenCalled();
		expect(mockConfirm).not.toHaveBeenCalled();
		expect(write).not.toHaveBeenCalled();
	});

	it("falls back to local with the no-terminal line when global is missing and there is no terminal", async () => {
		setTTY(false);
		mockCheck.mockResolvedValue(false);
		const result = await resolveLaunchModes(cwd, "global", write);
		expect(result.aide).toBe("local");
		expect(write).toHaveBeenCalledTimes(1);
		expect(write).toHaveBeenCalledWith(NO_TERMINAL_LINE);
		expect(mockInstall).not.toHaveBeenCalled();
	});

	it("keeps global when chosen interactively and the package is installed", async () => {
		setTTY(true);
		mockAsk.mockResolvedValue("global");
		mockCheck.mockResolvedValue(true);
		const result = await resolveLaunchModes(cwd, undefined, write);
		expect(result.aide).toBe("global");
		expect(mockAsk).toHaveBeenCalledWith("aide");
		expect(mockConfirm).not.toHaveBeenCalled();
	});

	it("installs and keeps global when the package is missing and the user confirms", async () => {
		setTTY(true);
		mockAsk.mockResolvedValue("global");
		mockCheck.mockResolvedValue(false);
		mockConfirm.mockResolvedValue(true);
		mockInstall.mockResolvedValue(true);
		const result = await resolveLaunchModes(cwd, undefined, write);
		expect(result.aide).toBe("global");
		expect(mockConfirm).toHaveBeenCalledWith(aidePackage.name, aidePackage.installCommand);
		expect(mockInstall).toHaveBeenCalledWith(aidePackage.installCommand);
		expect(write).not.toHaveBeenCalled();
	});

	it("falls back to local with the failed line when the install fails", async () => {
		setTTY(true);
		mockAsk.mockResolvedValue("global");
		mockCheck.mockResolvedValue(false);
		mockConfirm.mockResolvedValue(true);
		mockInstall.mockResolvedValue(false);
		const result = await resolveLaunchModes(cwd, undefined, write);
		expect(result.aide).toBe("local");
		expect(write).toHaveBeenCalledTimes(1);
		expect(write).toHaveBeenCalledWith(FAILED_LINE);
	});

	it("falls back to local with the declined line when the user declines", async () => {
		setTTY(true);
		mockAsk.mockResolvedValue("global");
		mockCheck.mockResolvedValue(false);
		mockConfirm.mockResolvedValue(false);
		const result = await resolveLaunchModes(cwd, undefined, write);
		expect(result.aide).toBe("local");
		expect(write).toHaveBeenCalledTimes(1);
		expect(write).toHaveBeenCalledWith(DECLINED_LINE);
		expect(mockInstall).not.toHaveBeenCalled();
	});

	it("never asks about aide when .mcp.json already has an aide key", async () => {
		setTTY(true);
		mockAsk.mockResolvedValue("local");
		await writeFile(
			join(cwd, ".mcp.json"),
			JSON.stringify({ mcpServers: { aide: { command: "aidemd-mcp", args: [] } } }),
		);
		const result = await resolveLaunchModes(cwd, undefined, write);
		expect(result.aide).toBe("local");
		expect(mockAsk).toHaveBeenCalledTimes(1);
		expect(mockAsk).toHaveBeenCalledWith("brain");
		expect(mockCheck).not.toHaveBeenCalled();
	});

	it("never asks about the brain when brain.aide already exists", async () => {
		setTTY(true);
		mockAsk.mockResolvedValue("local");
		await mkdir(join(cwd, ".aide", "config"), { recursive: true });
		await writeFile(join(cwd, ".aide", "config", "brain.aide"), "---\n---\n");
		const result = await resolveLaunchModes(cwd, undefined, write);
		expect(result.brain).toBe("local");
		expect(mockAsk).toHaveBeenCalledTimes(1);
		expect(mockAsk).toHaveBeenCalledWith("aide");
	});

	it("never checks the global package for a global brain choice", async () => {
		setTTY(true);
		mockAsk.mockImplementation(async (server: string) => (server === "brain" ? "global" : "local"));
		const result = await resolveLaunchModes(cwd, undefined, write);
		expect(result).toEqual({ aide: "local", brain: "global" });
		expect(mockCheck).not.toHaveBeenCalled();
	});
});
