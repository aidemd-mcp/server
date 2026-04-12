import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Mock } from "vitest";

vi.mock("node:fs/promises", () => ({
	readFile: vi.fn(),
}));

import { readFile } from "node:fs/promises";
import checkMcpConfig from "./index.js";

const mockReadFile = readFile as Mock;

const MCP_PATH = "/project/.mcp.json";
const CANONICAL_ENTRY = { command: "npx", args: ["@aidemd-mcp/server"] };

function canonical(): string {
	return JSON.stringify({ mcpServers: { aide: CANONICAL_ENTRY } }, null, 2) + "\n";
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

	describe("file exists with differing aide entry", () => {
		beforeEach(() => {
			mockReadFile.mockResolvedValue(
				JSON.stringify(
					{ mcpServers: { aide: { command: "node", args: ["old-aide.js"] } } },
					null,
					2,
				) + "\n",
			);
		});

		it("returns status 'differs'", async () => {
			const result = await checkMcpConfig(MCP_PATH);
			expect(result.status).toBe("differs");
		});

		it("includes prescription with canonical entry", async () => {
			const result = await checkMcpConfig(MCP_PATH);
			expect(result.prescription).toEqual({ key: "aide", entry: CANONICAL_ENTRY });
		});
	});

	describe("file exists with legacy 'aidemd-mcp' key", () => {
		beforeEach(() => {
			mockReadFile.mockResolvedValue(
				JSON.stringify({ mcpServers: { "aidemd-mcp": CANONICAL_ENTRY } }, null, 2) + "\n",
			);
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

	describe("no filesystem writes occur", () => {
		it("never writes to disk", async () => {
			mockReadFile.mockResolvedValue(canonical());
			await checkMcpConfig(MCP_PATH);
			// readFile was called once; module does not import writeFile
			expect(mockReadFile).toHaveBeenCalledOnce();
		});
	});
});
