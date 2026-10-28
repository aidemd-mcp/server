import { describe, it, expect, vi, beforeEach } from "vitest";
import { join } from "node:path";

vi.mock("@/service/install/wireMcp/index.js", () => ({
	default: vi.fn(),
}));
vi.mock("./installGlobalPackage/index.js", () => ({
	default: vi.fn(),
}));

import wireMcp from "@/service/install/wireMcp/index.js";
import installGlobalPackage from "./installGlobalPackage/index.js";
import ensureGlobalAide from "./index.js";
import type { InitStep } from "@/types/index.js";

const mockWireMcp = vi.mocked(wireMcp);
const mockInstall = vi.mocked(installGlobalPackage);

const CWD = "/project";
const NAME = "@aidemd-mcp/server";
const INSTALL_COMMAND = "npm i -g @aidemd-mcp/server";

function makeStep(overrides: Partial<InitStep> = {}): InitStep {
	return {
		name: "MCP config (aide)",
		status: "would-create",
		category: "mcp",
		filePath: join(CWD, ".mcp.json"),
		globalPackage: { name: NAME, installed: false, installCommand: INSTALL_COMMAND },
		...overrides,
	};
}

beforeEach(() => {
	vi.clearAllMocks();
});

describe("ensureGlobalAide", () => {
	it("plans the step against the project's .mcp.json", async () => {
		mockWireMcp.mockResolvedValue(makeStep({ status: "exists" }));

		await ensureGlobalAide(CWD, () => {});

		expect(mockWireMcp).toHaveBeenCalledWith(join(CWD, ".mcp.json"));
	});

	it("an existing aide entry — no install, no write line", async () => {
		mockWireMcp.mockResolvedValue(makeStep({ status: "exists", globalPackage: undefined }));
		const write = vi.fn();

		await ensureGlobalAide(CWD, write);

		expect(mockInstall).not.toHaveBeenCalled();
		expect(write).not.toHaveBeenCalled();
	});

	it("a malformed .mcp.json — no install, no write line", async () => {
		mockWireMcp.mockResolvedValue(makeStep({ configMalformed: true }));
		const write = vi.fn();

		await ensureGlobalAide(CWD, write);

		expect(mockInstall).not.toHaveBeenCalled();
		expect(write).not.toHaveBeenCalled();
	});

	it("the package already installed — no install, no write line", async () => {
		mockWireMcp.mockResolvedValue(
			makeStep({ globalPackage: { name: NAME, installed: true, installCommand: INSTALL_COMMAND } }),
		);
		const write = vi.fn();

		await ensureGlobalAide(CWD, write);

		expect(mockInstall).not.toHaveBeenCalled();
		expect(write).not.toHaveBeenCalled();
	});

	it("the package missing — writes one line naming the command, installs once, resolves", async () => {
		mockWireMcp.mockResolvedValue(makeStep());
		mockInstall.mockResolvedValue(true);
		const write = vi.fn();

		await expect(ensureGlobalAide(CWD, write)).resolves.toBeUndefined();

		expect(write).toHaveBeenCalledTimes(1);
		expect(write).toHaveBeenCalledWith(`Installing ${NAME} globally: ${INSTALL_COMMAND}`);
		expect(mockInstall).toHaveBeenCalledTimes(1);
		expect(mockInstall).toHaveBeenCalledWith(INSTALL_COMMAND);
	});

	it("the install fails — rejects with the exact message, after the write line", async () => {
		mockWireMcp.mockResolvedValue(makeStep());
		mockInstall.mockResolvedValue(false);
		const write = vi.fn();

		await expect(ensureGlobalAide(CWD, write)).rejects.toThrow(
			`${INSTALL_COMMAND} failed, so ${NAME} is not installed globally. Nothing was written. Fix the install (for example, npm permissions or network) and run init again.`,
		);

		expect(write).toHaveBeenCalledTimes(1);
		expect(write).toHaveBeenCalledWith(`Installing ${NAME} globally: ${INSTALL_COMMAND}`);
	});
});
