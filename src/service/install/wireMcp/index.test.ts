import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtemp, writeFile, rm, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir, platform } from "node:os";

vi.mock("../shared/checkGlobalPackage/index.js", () => ({ default: vi.fn() }));
vi.mock("node:os", async (importOriginal) => {
	const actual = await importOriginal<typeof import("node:os")>();
	return { ...actual, platform: vi.fn(actual.platform) };
});

import checkGlobalPackage from "../shared/checkGlobalPackage/index.js";
import wireMcp, { mcpEntry } from "./index.js";

const mockCheckGlobalPackage = checkGlobalPackage as ReturnType<typeof vi.fn>;
const mockPlatform = platform as ReturnType<typeof vi.fn>;
const realPlatform = platform();

const globalEntry = { command: "aidemd-mcp", args: [] };

let tempDir: string;
let mcpPath: string;

beforeEach(async () => {
	vi.clearAllMocks();
	mockCheckGlobalPackage.mockResolvedValue(false);
	tempDir = await mkdtemp(join(tmpdir(), "aide-wiremcp-"));
	mcpPath = join(tempDir, ".mcp.json");
});

afterEach(async () => {
	mockPlatform.mockReturnValue(realPlatform);
	await rm(tempDir, { recursive: true, force: true });
});

describe("mcpEntry", () => {
	it.each(["win32", "linux"])("is the bare global command with no path separators on %s", (os) => {
		mockPlatform.mockReturnValue(os);

		const entry = mcpEntry();

		expect(entry).toEqual(globalEntry);
		expect(entry.command).not.toMatch(/[\\/]/);
	});
});

describe("wireMcp would-create", () => {
	it.each(["win32", "linux"])("a cold run prescribes the global entry under key aide on %s", async (os) => {
		mockPlatform.mockReturnValue(os);

		const result = await wireMcp(mcpPath);

		expect(result.status).toBe("would-create");
		expect(result.category).toBe("mcp");
		expect(result.filePath).toBe(mcpPath);
		expect(result.prescription).toEqual({ key: "aide", entry: globalEntry });
	});

	it("a cold run carries globalPackage with installed true when the check passes", async () => {
		mockCheckGlobalPackage.mockResolvedValue(true);

		const result = await wireMcp(mcpPath);

		expect(result.globalPackage).toEqual({
			name: "@aidemd-mcp/server",
			installed: true,
			installCommand: "npm i -g @aidemd-mcp/server",
		});
		expect(mockCheckGlobalPackage).toHaveBeenCalledWith("@aidemd-mcp/server");
	});

	it("a cold run reports installed false when the package is not installed globally", async () => {
		const result = await wireMcp(mcpPath);

		expect(result.globalPackage?.installed).toBe(false);
	});

	it("a config without an aide key prescribes the global entry with globalPackage", async () => {
		mockCheckGlobalPackage.mockResolvedValue(true);
		await writeFile(mcpPath, JSON.stringify({ mcpServers: { other: { command: "node", args: ["other.js"] } } }), "utf-8");

		const result = await wireMcp(mcpPath);

		expect(result.status).toBe("would-create");
		expect(result.prescription).toEqual({ key: "aide", entry: globalEntry });
		expect(result.globalPackage?.installed).toBe(true);
	});

	it("a malformed config returns configMalformed with the prescription and globalPackage", async () => {
		await writeFile(mcpPath, "not valid json {{{", "utf-8");

		const result = await wireMcp(mcpPath);

		expect(result.status).toBe("would-create");
		expect(result.configMalformed).toBe(true);
		expect(result.prescription).toEqual({ key: "aide", entry: globalEntry });
		expect(result.globalPackage).toBeDefined();
		expect(result.globalPackage?.installed).toBe(false);
	});
});

describe("wireMcp install-first instructions", () => {
	const installInstruction =
		"The aide server is not installed globally. Run `npm i -g @aidemd-mcp/server` via Bash before merging this prescription. If the install fails, tell the user and do not merge the entry.";

	it("a cold run with the package not installed carries the install instruction", async () => {
		const result = await wireMcp(mcpPath);

		expect(result.instructions).toBe(installInstruction);
	});

	it("a config without an aide key and the package not installed carries the install instruction", async () => {
		await writeFile(mcpPath, JSON.stringify({ mcpServers: { other: { command: "node", args: ["other.js"] } } }), "utf-8");

		const result = await wireMcp(mcpPath);

		expect(result.instructions).toBe(installInstruction);
	});

	it("a cold run with the package installed has no instructions property", async () => {
		mockCheckGlobalPackage.mockResolvedValue(true);

		const result = await wireMcp(mcpPath);

		expect(result).not.toHaveProperty("instructions");
	});

	it("a malformed config with the package not installed has no instructions property", async () => {
		await writeFile(mcpPath, "not valid json {{{", "utf-8");

		const result = await wireMcp(mcpPath);

		expect(result).not.toHaveProperty("instructions");
	});

	it("an existing aide key has no instructions property", async () => {
		await writeFile(mcpPath, JSON.stringify({ mcpServers: { aide: globalEntry } }), "utf-8");

		const result = await wireMcp(mcpPath);

		expect(result).not.toHaveProperty("instructions");
	});
});

describe("wireMcp exists", () => {
	it.each(["aide", "aidemd-mcp"])("an existing %s key returns exists without globalPackage or the npm check", async (key) => {
		await writeFile(mcpPath, JSON.stringify({ mcpServers: { [key]: globalEntry } }), "utf-8");

		const result = await wireMcp(mcpPath);

		expect(result.status).toBe("exists");
		expect(result.prescription).toBeUndefined();
		expect(result.globalPackage).toBeUndefined();
		expect(mockCheckGlobalPackage).not.toHaveBeenCalled();
	});
});

describe("wireMcp side effects", () => {
	it("never writes to disk", async () => {
		await wireMcp(mcpPath);

		await expect(readFile(mcpPath, "utf-8")).rejects.toThrow();
	});
});
