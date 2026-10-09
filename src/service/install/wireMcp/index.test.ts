import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir, platform } from "node:os";

vi.mock("../shared/checkGlobalPackage/index.js", () => ({ default: vi.fn() }));
vi.mock("node:os", async (importOriginal) => {
	const actual = await importOriginal<typeof import("node:os")>();
	return { ...actual, platform: vi.fn(actual.platform) };
});

import checkGlobalPackage from "../shared/checkGlobalPackage/index.js";
import readAidePackageVersion from "../shared/readAidePackageVersion/index.js";
import wireMcp, { mcpEntry } from "./index.js";

const mockCheckGlobalPackage = checkGlobalPackage as ReturnType<typeof vi.fn>;
const mockPlatform = platform as ReturnType<typeof vi.fn>;
const realPlatform = platform();
const pinnedSpec = `@aidemd-mcp/server@${readAidePackageVersion()}`;

const expectedEntry =
	realPlatform === "win32"
		? { command: "cmd", args: ["/c", "npx", "-y", pinnedSpec] }
		: { command: "npx", args: ["-y", pinnedSpec] };

let tempDir: string;

beforeEach(async () => {
	vi.clearAllMocks();
	mockCheckGlobalPackage.mockResolvedValue(false);
	tempDir = await mkdtemp(join(tmpdir(), "aide-wiremcp-"));
});

afterEach(async () => {
	await rm(tempDir, { recursive: true, force: true });
});

describe("wireMcp", () => {
	it("returns would-create with prescription when no config exists", async () => {
		const mcpPath = join(tempDir, ".mcp.json");

		const result = await wireMcp(mcpPath);

		expect(result.status).toBe("would-create");
		expect(result.prescription?.key).toBe("aide");
		expect(result.prescription?.entry).toEqual(expectedEntry);
		expect(result.category).toBe("mcp");
	});

	it("returns would-create with prescription when config exists but has no aide entry", async () => {
		const mcpPath = join(tempDir, ".mcp.json");
		const existing = {
			mcpServers: {
				other: { command: "node", args: ["other.js"] },
			},
		};
		await writeFile(mcpPath, JSON.stringify(existing), "utf-8");

		const result = await wireMcp(mcpPath);

		expect(result.status).toBe("would-create");
		expect(result.prescription?.key).toBe("aide");
		expect(result.prescription?.entry).toEqual(expectedEntry);
		// Prescription is provided; agent merges into config, not this helper
	});

	it("returns exists when aide entry is already present", async () => {
		const mcpPath = join(tempDir, ".mcp.json");
		const existing = {
			mcpServers: {
				aide: expectedEntry,
			},
		};
		await writeFile(mcpPath, JSON.stringify(existing), "utf-8");

		const result = await wireMcp(mcpPath);

		expect(result.status).toBe("exists");
		expect(result.prescription).toBeUndefined();
	});

	it("returns would-create with configMalformed when config contains invalid JSON", async () => {
		const mcpPath = join(tempDir, ".mcp.json");
		await writeFile(mcpPath, "not valid json {{{", "utf-8");

		const result = await wireMcp(mcpPath);

		expect(result.status).toBe("would-create");
		expect(result.configMalformed).toBe(true);
		// Prescription is still present so agent can create a fresh config
		expect(result.prescription?.key).toBe("aide");
	});

	it("never writes to disk", async () => {
		const mcpPath = join(tempDir, ".mcp.json");

		await wireMcp(mcpPath);

		// No file should have been created
		await expect(import("node:fs/promises").then((fs) => fs.readFile(mcpPath, "utf-8"))).rejects.toThrow();
	});

	it("result has correct filePath", async () => {
		const mcpPath = join(tempDir, ".mcp.json");

		const result = await wireMcp(mcpPath);

		expect(result.filePath).toBe(mcpPath);
	});
});

describe("mcpEntry", () => {
	afterEach(() => {
		mockPlatform.mockReturnValue(realPlatform);
	});

	it("defaults to the local mode", () => {
		expect(mcpEntry()).toEqual(mcpEntry("local"));
	});

	it.each([
		["win32", { command: "cmd", args: ["/c", "npx", "-y", pinnedSpec] }],
		["linux", { command: "npx", args: ["-y", pinnedSpec] }],
		["darwin", { command: "npx", args: ["-y", pinnedSpec] }],
	])("local on %s is pinned with -y and never @latest", (os, expected) => {
		mockPlatform.mockReturnValue(os);

		const entry = mcpEntry("local");

		expect(entry).toEqual(expected);
		expect(entry.args).toContain("-y");
		expect(entry.args.join(" ")).not.toContain("@latest");
		expect(entry.args[entry.args.length - 1]).toBe(pinnedSpec);
	});

	it.each(["win32", "linux", "darwin"])("global on %s is the bare command with no path separators", (os) => {
		mockPlatform.mockReturnValue(os);

		const entry = mcpEntry("global");

		expect(entry).toEqual({ command: "aidemd-mcp", args: [] });
		expect(entry.command).not.toMatch(/[\/]/);
		for (const arg of entry.args) expect(arg).not.toMatch(/[\/]/);
	});
});

describe("wireMcp launch modes", () => {
	it("a cold global run carries globalPackage with installed from the check", async () => {
		mockCheckGlobalPackage.mockResolvedValue(true);

		const result = await wireMcp(join(tempDir, ".mcp.json"), "global");

		expect(result.status).toBe("would-create");
		expect(result.prescription?.entry).toEqual(mcpEntry("global"));
		expect(result.globalPackage).toEqual({
			name: "@aidemd-mcp/server",
			installed: true,
			installCommand: "npm i -g @aidemd-mcp/server",
		});
		expect(mockCheckGlobalPackage).toHaveBeenCalledWith("@aidemd-mcp/server");
	});

	it("reports installed false when the package is not installed globally", async () => {
		const result = await wireMcp(join(tempDir, ".mcp.json"), "global");

		expect(result.globalPackage?.installed).toBe(false);
	});

	it("carries globalPackage on a global would-create with a malformed config", async () => {
		const mcpPath = join(tempDir, ".mcp.json");
		await writeFile(mcpPath, "not valid json {{{", "utf-8");

		const result = await wireMcp(mcpPath, "global");

		expect(result.configMalformed).toBe(true);
		expect(result.globalPackage).toBeDefined();
	});

	it("carries globalPackage on a global would-create when the config lacks an aide entry", async () => {
		const mcpPath = join(tempDir, ".mcp.json");
		await writeFile(mcpPath, JSON.stringify({ mcpServers: { other: { command: "node" } } }), "utf-8");

		const result = await wireMcp(mcpPath, "global");

		expect(result.status).toBe("would-create");
		expect(result.globalPackage).toBeDefined();
	});

	it("global with an existing aide key returns exists without globalPackage", async () => {
		const mcpPath = join(tempDir, ".mcp.json");
		await writeFile(mcpPath, JSON.stringify({ mcpServers: { aide: expectedEntry } }), "utf-8");

		const result = await wireMcp(mcpPath, "global");

		expect(result.status).toBe("exists");
		expect(result.globalPackage).toBeUndefined();
	});

	it("local omits globalPackage and never runs the global check", async () => {
		const result = await wireMcp(join(tempDir, ".mcp.json"));

		expect(result.globalPackage).toBeUndefined();
		expect(mockCheckGlobalPackage).not.toHaveBeenCalled();
	});
});
