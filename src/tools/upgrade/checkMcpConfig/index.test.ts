import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Mock } from "vitest";

vi.mock("node:fs/promises", () => ({
	readFile: vi.fn(),
}));

import { readFile } from "node:fs/promises";
import checkMcpConfig from "./index.js";
import { mcpEntry } from "@/service/install/wireMcp/index.js";

const mockReadFile = readFile as Mock;

const MCP_PATH = "/project/.mcp.json";
const CANONICAL_ENTRY = mcpEntry("local");
const GLOBAL_ENTRY = mcpEntry("global");
const PATH_TIP =
	"The aide entry launches the global install by absolute path. A bare `aidemd-mcp` command is more portable if `.mcp.json` is committed.";

function configWith(entry: { command: unknown; args: unknown }, key = "aide"): string {
	return JSON.stringify({ mcpServers: { [key]: entry } }, null, 2) + "\n";
}

function canonical(): string {
	return configWith(CANONICAL_ENTRY);
}

function enoent(): NodeJS.ErrnoException {
	const err = new Error("ENOENT: no such file or directory") as NodeJS.ErrnoException;
	err.code = "ENOENT";
	return err;
}

beforeEach(() => {
	vi.resetAllMocks();
});

describe("checkMcpConfig", () => {
	describe("file does not exist", () => {
		beforeEach(() => {
			mockReadFile.mockRejectedValue(enoent());
		});

		it("returns status 'missing'", async () => {
			const result = await checkMcpConfig(MCP_PATH);
			expect(result.status).toBe("missing");
		});

		it("returns category 'mcp'", async () => {
			const result = await checkMcpConfig(MCP_PATH);
			expect(result.category).toBe("mcp");
		});

		it("includes prescription with key 'aide' and canonical entry", async () => {
			const result = await checkMcpConfig(MCP_PATH);
			expect(result.prescription).toEqual({ key: "aide", entry: CANONICAL_ENTRY });
		});

		it("includes filePath", async () => {
			const result = await checkMcpConfig(MCP_PATH);
			expect(result.filePath).toBe(MCP_PATH);
		});
	});

	describe("file exists but is malformed JSON", () => {
		beforeEach(() => {
			mockReadFile.mockResolvedValue("{ this is not json }");
		});

		it("returns status 'malformed'", async () => {
			const result = await checkMcpConfig(MCP_PATH);
			expect(result.status).toBe("malformed");
		});

		it("does not include prescription", async () => {
			const result = await checkMcpConfig(MCP_PATH);
			expect(result.prescription).toBeUndefined();
		});

		it("does not include canonicalContent", async () => {
			const result = await checkMcpConfig(MCP_PATH);
			expect(result.canonicalContent).toBeUndefined();
		});
	});

	describe("file exists with canonical aide entry", () => {
		beforeEach(() => {
			mockReadFile.mockResolvedValue(canonical());
		});

		it("returns status 'matches'", async () => {
			const result = await checkMcpConfig(MCP_PATH);
			expect(result.status).toBe("matches");
		});

		it("does not include prescription", async () => {
			const result = await checkMcpConfig(MCP_PATH);
			expect(result.prescription).toBeUndefined();
		});
	});

	describe("file exists with missing aide entry", () => {
		beforeEach(() => {
			mockReadFile.mockResolvedValue(
				JSON.stringify({ mcpServers: { other: { command: "node", args: ["other.js"] } } }, null, 2) + "\n",
			);
		});

		it("returns status 'differs'", async () => {
			const result = await checkMcpConfig(MCP_PATH);
			expect(result.status).toBe("differs");
		});

		it("includes prescription", async () => {
			const result = await checkMcpConfig(MCP_PATH);
			expect(result.prescription).toEqual({ key: "aide", entry: CANONICAL_ENTRY });
		});
	});

	describe("local npx entries are judged against the pinned canonical", () => {
		const spec = CANONICAL_ENTRY.args[CANONICAL_ENTRY.args.length - 1] as string;
		const pkg = spec.slice(0, spec.lastIndexOf("@"));
		const drifted: Array<[string, string[]]> = [
			["unpinned", ["-y", pkg]],
			["@latest", ["-y", `${pkg}@latest`]],
			["older pin", ["-y", `${pkg}@0.0.1`]],
			["current pin without -y", [spec]],
		];

		it("matches when pinned to the current version, with no prescription and no tip", async () => {
			mockReadFile.mockResolvedValue(canonical());
			const result = await checkMcpConfig(MCP_PATH);
			expect(result.status).toBe("matches");
			expect(result.prescription).toBeUndefined();
			expect(result.tip).toBeUndefined();
		});

		it.each(drifted)("differs for %s, prescribing local", async (_label, args) => {
			mockReadFile.mockResolvedValue(configWith({ command: "npx", args }));
			const result = await checkMcpConfig(MCP_PATH);
			expect(result.status).toBe("differs");
			expect(result.prescription).toEqual({ key: "aide", entry: CANONICAL_ENTRY });
		});

		it.each(drifted)("differs for %s wrapped in cmd /c, prescribing local", async (_label, args) => {
			mockReadFile.mockResolvedValue(configWith({ command: "cmd", args: ["/c", "npx", ...args] }));
			const result = await checkMcpConfig(MCP_PATH);
			expect(result.status).toBe("differs");
			expect(result.prescription).toEqual({ key: "aide", entry: CANONICAL_ENTRY });
		});
	});

	describe("global aidemd-mcp entries", () => {
		it("matches the bare name with no tip", async () => {
			mockReadFile.mockResolvedValue(configWith(GLOBAL_ENTRY));
			const result = await checkMcpConfig(MCP_PATH);
			expect(result.status).toBe("matches");
			expect(result.prescription).toBeUndefined();
			expect(result.tip).toBeUndefined();
		});

		it("matches an absolute-path cmd shim and carries the tip", async () => {
			mockReadFile.mockResolvedValue(
				configWith({
					command: "cmd",
					args: ["/c", "C:\\Users\\x\\AppData\\Roaming\\npm\\aidemd-mcp.cmd"],
				}),
			);
			const result = await checkMcpConfig(MCP_PATH);
			expect(result.status).toBe("matches");
			expect(result.prescription).toBeUndefined();
			expect(result.tip).toBe(PATH_TIP);
		});

		it("matches a POSIX absolute path and carries the tip", async () => {
			mockReadFile.mockResolvedValue(configWith({ command: "/usr/local/bin/aidemd-mcp", args: [] }));
			const result = await checkMcpConfig(MCP_PATH);
			expect(result.status).toBe("matches");
			expect(result.tip).toBe(PATH_TIP);
		});

		it("differs with extra args, prescribing global", async () => {
			mockReadFile.mockResolvedValue(configWith({ command: "aidemd-mcp", args: ["--root", "x"] }));
			const result = await checkMcpConfig(MCP_PATH);
			expect(result.status).toBe("differs");
			expect(result.prescription).toEqual({ key: "aide", entry: GLOBAL_ENTRY });
		});
	});

	describe("custom entries are left alone", () => {
		it.each([
			["dev form", { command: "node", args: ["dist/index.js"] }],
			["random command", { command: "my-wrapper", args: ["--serve"] }],
			["cmd /c wrapper of something else", { command: "cmd", args: ["/c", "run-aide.bat"] }],
			["malformed command", { command: 42, args: [] }],
		])("%s matches with no prescription and no tip", async (_label, entry) => {
			mockReadFile.mockResolvedValue(configWith(entry));
			const result = await checkMcpConfig(MCP_PATH);
			expect(result.status).toBe("matches");
			expect(result.prescription).toBeUndefined();
			expect(result.tip).toBeUndefined();
		});
	});

	describe("file exists with legacy 'aidemd-mcp' key", () => {
		beforeEach(() => {
			mockReadFile.mockResolvedValue(configWith(CANONICAL_ENTRY, "aidemd-mcp"));
		});

		it("returns status 'differs' (legacy key is detected as drift)", async () => {
			const result = await checkMcpConfig(MCP_PATH);
			expect(result.status).toBe("differs");
		});

		it("includes prescription so agent can migrate to 'aide' key", async () => {
			const result = await checkMcpConfig(MCP_PATH);
			expect(result.prescription).toEqual({ key: "aide", entry: CANONICAL_ENTRY });
		});
	});

	describe("file exists with legacy 'aidemd-mcp' key holding a global entry", () => {
		it("differs, prescribing global", async () => {
			mockReadFile.mockResolvedValue(configWith(GLOBAL_ENTRY, "aidemd-mcp"));
			const result = await checkMcpConfig(MCP_PATH);
			expect(result.status).toBe("differs");
			expect(result.prescription).toEqual({ key: "aide", entry: GLOBAL_ENTRY });
		});
	});

	describe("no filesystem writes occur", () => {
		it("never writes to disk", async () => {
			mockReadFile.mockResolvedValue(canonical());
			await checkMcpConfig(MCP_PATH);
			// readFile was called once; module does not import writeFile
			expect(mockReadFile).toHaveBeenCalledOnce();
		});
	});
});
