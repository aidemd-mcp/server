import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import readAideLaunchMode from "./index.js";

let tempDir: string;

beforeEach(async () => {
	tempDir = await mkdtemp(join(tmpdir(), "aide-launch-mode-"));
});

afterEach(async () => {
	await rm(tempDir, { recursive: true, force: true });
});

async function writeMcp(content: string): Promise<void> {
	await writeFile(join(tempDir, ".mcp.json"), content);
}

describe("readAideLaunchMode", () => {
	it("returns global for a bin-launched aide entry", async () => {
		await writeMcp(JSON.stringify({ mcpServers: { aide: { command: "aidemd-mcp", args: [] } } }));
		expect(await readAideLaunchMode(tempDir)).toBe("global");
	});

	it("returns local for an npx-launched aide entry", async () => {
		await writeMcp(
			JSON.stringify({ mcpServers: { aide: { command: "npx", args: ["-y", "@aidemd-mcp/server@latest"] } } }),
		);
		expect(await readAideLaunchMode(tempDir)).toBe("local");
	});

	it("falls back to the legacy aidemd-mcp key", async () => {
		await writeMcp(
			JSON.stringify({ mcpServers: { "aidemd-mcp": { command: "npx", args: ["-y", "@aidemd-mcp/server"] } } }),
		);
		expect(await readAideLaunchMode(tempDir)).toBe("local");
	});

	it("returns null when the config file is absent", async () => {
		expect(await readAideLaunchMode(tempDir)).toBeNull();
	});

	it("returns null for malformed JSON", async () => {
		await writeMcp("{ not json");
		expect(await readAideLaunchMode(tempDir)).toBeNull();
	});

	it("returns null when mcpServers is missing", async () => {
		await writeMcp(JSON.stringify({}));
		expect(await readAideLaunchMode(tempDir)).toBeNull();
	});

	it("returns null when no aide entry exists", async () => {
		await writeMcp(JSON.stringify({ mcpServers: { brain: { command: "x", args: [] } } }));
		expect(await readAideLaunchMode(tempDir)).toBeNull();
	});
});
