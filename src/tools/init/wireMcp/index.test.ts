import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import wireMcp from "./index.js";

let tempDir: string;

beforeEach(async () => {
	tempDir = await mkdtemp(join(tmpdir(), "aide-wiremcp-"));
});

afterEach(async () => {
	await rm(tempDir, { recursive: true, force: true });
});

describe("wireMcp", () => {
	it("creates a fresh MCP config when none exists", async () => {
		const mcpPath = join(tempDir, ".mcp.json");

		const result = await wireMcp(mcpPath);

		expect(result).toEqual({ name: "MCP config", status: "wired" });
		const mcp = JSON.parse(await readFile(mcpPath, "utf-8"));
		expect(mcp.mcpServers.aide).toEqual({ command: "npx", args: ["aidemd-mcp"] });
	});

	it("adds to existing MCP config without overwriting other servers", async () => {
		const mcpPath = join(tempDir, ".mcp.json");
		const existing = {
			mcpServers: {
				other: { command: "node", args: ["other.js"] },
			},
		};
		await writeFile(mcpPath, JSON.stringify(existing), "utf-8");

		await wireMcp(mcpPath);

		const mcp = JSON.parse(await readFile(mcpPath, "utf-8"));
		expect(mcp.mcpServers.other).toEqual({ command: "node", args: ["other.js"] });
		expect(mcp.mcpServers.aide).toEqual({ command: "npx", args: ["aidemd-mcp"] });
	});

	it("returns exists when aide entry is already wired", async () => {
		const mcpPath = join(tempDir, ".mcp.json");
		const existing = {
			mcpServers: {
				aide: { command: "npx", args: ["aidemd-mcp"] },
			},
		};
		await writeFile(mcpPath, JSON.stringify(existing), "utf-8");

		const result = await wireMcp(mcpPath);

		expect(result).toEqual({ name: "MCP config", status: "exists" });
	});

	it("skips when MCP config contains invalid JSON", async () => {
		const mcpPath = join(tempDir, ".mcp.json");
		await writeFile(mcpPath, "not valid json {{{", "utf-8");

		const result = await wireMcp(mcpPath);

		expect(result).toEqual({ name: "MCP config", status: "skipped" });
	});
});
