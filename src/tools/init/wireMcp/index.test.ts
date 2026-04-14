import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir, platform } from "node:os";
import wireMcp, { mcpEntry } from "./index.js";

const expectedEntry =
	platform() === "win32"
		? { command: "cmd", args: ["/c", "npx", "@aidemd-mcp/server"] }
		: { command: "npx", args: ["@aidemd-mcp/server"] };

let tempDir: string;

beforeEach(async () => {
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
				aide: { command: "npx", args: ["@aidemd-mcp/server"] },
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
