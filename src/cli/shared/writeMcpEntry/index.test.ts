import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import writeMcpEntry from "./index.js";

let tempDir: string;

beforeEach(async () => {
	tempDir = await mkdtemp(join(tmpdir(), "aide-shared-writemcp-"));
});

afterEach(async () => {
	await rm(tempDir, { recursive: true, force: true });
});

const brainEntry = { command: "npx", args: ["-y", "obsidian-mcp", "/my/vault"] };
const otherEntry = { command: "npx", args: ["-y", "some-mcp"] };

describe("writeMcpEntry (shared)", () => {
	// --- creates file when absent ---

	it("creates .mcp.json with the given key when the file does not exist", async () => {
		const result = await writeMcpEntry(tempDir, { brain: brainEntry });

		expect(result.written).toEqual(["brain"]);
		expect(result.deleted).toEqual([]);
		expect(result.unchanged).toBe(false);

		const written = await readFile(join(tempDir, ".mcp.json"), "utf-8");
		const parsed = JSON.parse(written);
		expect(parsed.mcpServers.brain).toEqual(brainEntry);
	});

	// --- preserves unrelated keys ---

	it("preserves unrelated mcpServers keys when setting a new key", async () => {
		const existing = {
			mcpServers: { other: otherEntry },
		};
		await writeFile(join(tempDir, ".mcp.json"), JSON.stringify(existing, null, 2), "utf-8");

		const result = await writeMcpEntry(tempDir, { brain: brainEntry });

		expect(result.written).toEqual(["brain"]);
		expect(result.unchanged).toBe(false);

		const written = await readFile(join(tempDir, ".mcp.json"), "utf-8");
		const parsed = JSON.parse(written);
		expect(parsed.mcpServers.other).toEqual(otherEntry);
		expect(parsed.mcpServers.brain).toEqual(brainEntry);
	});

	it("preserves top-level keys outside mcpServers", async () => {
		const existing = {
			someTopLevelKey: "preserve-me",
			mcpServers: { other: otherEntry },
		};
		await writeFile(join(tempDir, ".mcp.json"), JSON.stringify(existing, null, 2), "utf-8");

		await writeMcpEntry(tempDir, { brain: brainEntry });

		const written = await readFile(join(tempDir, ".mcp.json"), "utf-8");
		const parsed = JSON.parse(written);
		expect(parsed.someTopLevelKey).toBe("preserve-me");
	});

	// --- idempotency (unchanged: true) ---

	it("returns unchanged: true when the key is already set to the identical entry", async () => {
		const existing = {
			mcpServers: { brain: brainEntry },
		};
		const originalJson = JSON.stringify(existing, null, 2) + "\n";
		await writeFile(join(tempDir, ".mcp.json"), originalJson, "utf-8");

		const result = await writeMcpEntry(tempDir, { brain: brainEntry });

		expect(result.written).toEqual([]);
		expect(result.deleted).toEqual([]);
		expect(result.unchanged).toBe(true);

		// File must not have been touched.
		const after = await readFile(join(tempDir, ".mcp.json"), "utf-8");
		expect(after).toBe(originalJson);
	});

	// --- delete ---

	it("deletes a key that is present", async () => {
		const existing = {
			mcpServers: { obsidian: otherEntry, brain: brainEntry },
		};
		await writeFile(join(tempDir, ".mcp.json"), JSON.stringify(existing, null, 2), "utf-8");

		const result = await writeMcpEntry(tempDir, { obsidian: "delete" });

		expect(result.deleted).toEqual(["obsidian"]);
		expect(result.written).toEqual([]);
		expect(result.unchanged).toBe(false);

		const written = await readFile(join(tempDir, ".mcp.json"), "utf-8");
		const parsed = JSON.parse(written);
		expect(parsed.mcpServers.obsidian).toBeUndefined();
		expect(parsed.mcpServers.brain).toEqual(brainEntry);
	});

	it("treats deleting an absent key as a no-op (does not write the file)", async () => {
		const existing = {
			mcpServers: { brain: brainEntry },
		};
		const originalJson = JSON.stringify(existing, null, 2) + "\n";
		await writeFile(join(tempDir, ".mcp.json"), originalJson, "utf-8");

		const result = await writeMcpEntry(tempDir, { obsidian: "delete" });

		expect(result.deleted).toEqual([]);
		expect(result.unchanged).toBe(true);

		const after = await readFile(join(tempDir, ".mcp.json"), "utf-8");
		expect(after).toBe(originalJson);
	});

	// --- mixed set + delete ---

	it("applies a set and a delete in a single call", async () => {
		const oldBrain = { command: "npx", args: ["-y", "obsidian-mcp", "/old/vault"] };
		const existing = {
			mcpServers: { obsidian: otherEntry, brain: oldBrain },
		};
		await writeFile(join(tempDir, ".mcp.json"), JSON.stringify(existing, null, 2), "utf-8");

		const result = await writeMcpEntry(tempDir, {
			brain: brainEntry,
			obsidian: "delete",
		});

		expect(result.written).toEqual(["brain"]);
		expect(result.deleted).toEqual(["obsidian"]);
		expect(result.unchanged).toBe(false);

		const written = await readFile(join(tempDir, ".mcp.json"), "utf-8");
		const parsed = JSON.parse(written);
		expect(parsed.mcpServers.brain).toEqual(brainEntry);
		expect(parsed.mcpServers.obsidian).toBeUndefined();
	});

	it("mixed: unchanged is false even when set is no-op but delete fires", async () => {
		const existing = {
			mcpServers: { obsidian: otherEntry, brain: brainEntry },
		};
		await writeFile(join(tempDir, ".mcp.json"), JSON.stringify(existing, null, 2), "utf-8");

		// brain is already in sync but obsidian needs deleting.
		const result = await writeMcpEntry(tempDir, {
			brain: brainEntry,
			obsidian: "delete",
		});

		expect(result.written).toEqual([]);
		expect(result.deleted).toEqual(["obsidian"]);
		expect(result.unchanged).toBe(false);
	});

	// --- malformed JSON ---

	it("throws the spec-documented message when .mcp.json contains malformed JSON", async () => {
		await writeFile(join(tempDir, ".mcp.json"), "{ not valid json {{{{", "utf-8");

		await expect(writeMcpEntry(tempDir, { brain: brainEntry })).rejects.toThrow(
			".mcp.json exists but contains invalid JSON. Fix the syntax error and re-run.",
		);
	});

	// --- serialization format ---

	it("writes JSON with 2-space indent and trailing newline", async () => {
		await writeMcpEntry(tempDir, { brain: brainEntry });

		const written = await readFile(join(tempDir, ".mcp.json"), "utf-8");

		expect(written).toMatch(/^\{/);
		expect(written.endsWith("\n")).toBe(true);
		expect(written).toContain('  "mcpServers"');
	});

	// --- structural equality on args ---

	it("detects a changed arg and writes the update", async () => {
		const oldEntry = { command: "npx", args: ["-y", "obsidian-mcp", "/old/vault"] };
		const newEntry = { command: "npx", args: ["-y", "obsidian-mcp", "/new/vault"] };
		const existing = { mcpServers: { brain: oldEntry } };
		await writeFile(join(tempDir, ".mcp.json"), JSON.stringify(existing, null, 2), "utf-8");

		const result = await writeMcpEntry(tempDir, { brain: newEntry });

		expect(result.written).toEqual(["brain"]);
		expect(result.unchanged).toBe(false);

		const written = await readFile(join(tempDir, ".mcp.json"), "utf-8");
		const parsed = JSON.parse(written);
		expect(parsed.mcpServers.brain.args[2]).toBe("/new/vault");
	});

	it("detects a changed command and writes the update", async () => {
		const oldEntry = { command: "node", args: ["server.js"] };
		const newEntry = { command: "npx", args: ["server.js"] };
		const existing = { mcpServers: { brain: oldEntry } };
		await writeFile(join(tempDir, ".mcp.json"), JSON.stringify(existing, null, 2), "utf-8");

		const result = await writeMcpEntry(tempDir, { brain: newEntry });

		expect(result.written).toEqual(["brain"]);
		expect(result.unchanged).toBe(false);
	});

	// --- empty entries map ---

	it("returns unchanged: true for an empty entries map", async () => {
		const result = await writeMcpEntry(tempDir, {});

		expect(result.unchanged).toBe(true);
		expect(result.written).toEqual([]);
		expect(result.deleted).toEqual([]);
	});
});
