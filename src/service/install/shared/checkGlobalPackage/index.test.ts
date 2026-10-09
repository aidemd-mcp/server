import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const execState = vi.hoisted(() => ({
	result: null as null | { stdout: string } | { error: Error },
}));

vi.mock("node:child_process", async () => {
	const { promisify } = await import("node:util");
	// Mirrors the real exec's custom promisify shape: resolves { stdout, stderr }.
	const exec = Object.assign(() => undefined, {
		[promisify.custom]: async () => {
			if (execState.result === null) throw new Error("exec result not configured");
			if ("error" in execState.result) throw execState.result.error;
			return { stdout: execState.result.stdout, stderr: "" };
		},
	});
	return { exec };
});

import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import checkGlobalPackage from "./index.js";

let root: string;

beforeEach(async () => {
	root = await mkdtemp(join(tmpdir(), "aide-global-root-"));
	execState.result = { stdout: `${root}\n` };
});

afterEach(async () => {
	await rm(root, { recursive: true, force: true });
});

describe("checkGlobalPackage", () => {
	it("is true when <root>/<name>/package.json exists", async () => {
		await mkdir(join(root, "@aidemd-mcp", "server"), { recursive: true });
		await writeFile(join(root, "@aidemd-mcp", "server", "package.json"), "{}");

		await expect(checkGlobalPackage("@aidemd-mcp/server")).resolves.toBe(true);
	});

	it("is false when the package is absent", async () => {
		await expect(checkGlobalPackage("@aidemd-mcp/server")).resolves.toBe(false);
	});

	it("is false when exec errors", async () => {
		execState.result = { error: new Error("npm: command not found") };

		await expect(checkGlobalPackage("@aidemd-mcp/server")).resolves.toBe(false);
	});

	it("is false when stdout is empty", async () => {
		execState.result = { stdout: "  \n" };

		await expect(checkGlobalPackage("@aidemd-mcp/server")).resolves.toBe(false);
	});
});
