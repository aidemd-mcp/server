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
import locateEntry from "./index.js";

let root: string;
let packageDir: string;

async function installPackage(manifest: unknown, files: string[] = ["dist/index.js"]): Promise<void> {
	await mkdir(packageDir, { recursive: true });
	await writeFile(join(packageDir, "package.json"), JSON.stringify(manifest));
	for (const file of files) {
		await mkdir(join(packageDir, file, ".."), { recursive: true });
		await writeFile(join(packageDir, file), "");
	}
}

beforeEach(async () => {
	root = await mkdtemp(join(tmpdir(), "aide-locate-root-"));
	packageDir = join(root, "@aidemd-mcp", "server");
	execState.result = { stdout: `${root}\n` };
});

afterEach(async () => {
	await rm(root, { recursive: true, force: true });
});

describe("locateEntry", () => {
	it("resolves the bin record's aidemd-mcp entry as a forward-slash absolute path", async () => {
		await installPackage({ bin: { "aidemd-mcp": "dist/index.js" } });

		const entry = await locateEntry();

		expect(entry).toBe(join(packageDir, "dist", "index.js").replace(/\\/g, "/"));
		expect(entry).not.toContain("\\");
	});

	it("resolves a string bin", async () => {
		await installPackage({ bin: "dist/cli.js" }, ["dist/cli.js"]);

		await expect(locateEntry()).resolves.toBe(join(packageDir, "dist", "cli.js").replace(/\\/g, "/"));
	});

	it("reads the entry from bin, never a hardcoded dist/index.js", async () => {
		await installPackage({ bin: { "aidemd-mcp": "build/main.js" } }, ["build/main.js"]);

		await expect(locateEntry()).resolves.toBe(join(packageDir, "build", "main.js").replace(/\\/g, "/"));
	});

	it("is null when npm fails", async () => {
		execState.result = { error: new Error("npm: command not found") };

		await expect(locateEntry()).resolves.toBeNull();
	});

	it("is null when npm times out", async () => {
		execState.result = { error: Object.assign(new Error("timed out"), { killed: true }) };

		await expect(locateEntry()).resolves.toBeNull();
	});

	it("is null when the root is empty", async () => {
		execState.result = { stdout: "  \n" };

		await expect(locateEntry()).resolves.toBeNull();
	});

	it("is null when the package is not installed", async () => {
		await expect(locateEntry()).resolves.toBeNull();
	});

	it("is null when the manifest has no bin", async () => {
		await installPackage({ name: "@aidemd-mcp/server" });

		await expect(locateEntry()).resolves.toBeNull();
	});

	it("is null when the bin record lacks the aidemd-mcp command", async () => {
		await installPackage({ bin: { other: "dist/index.js" } });

		await expect(locateEntry()).resolves.toBeNull();
	});

	it("is null when the bin file is missing", async () => {
		await installPackage({ bin: { "aidemd-mcp": "dist/index.js" } }, []);

		await expect(locateEntry()).resolves.toBeNull();
	});

	it("is null when the manifest is not JSON", async () => {
		await mkdir(packageDir, { recursive: true });
		await writeFile(join(packageDir, "package.json"), "not json");

		await expect(locateEntry()).resolves.toBeNull();
	});

	it("is null when the path contains a double quote", async () => {
		// A quote in a file name is not creatable on Windows, so the case only runs
		// where the platform allows it.
		const quoted = join(root, 'q"uote');
		try {
			await mkdir(join(quoted, "@aidemd-mcp", "server", "dist"), { recursive: true });
		} catch {
			return;
		}
		await writeFile(join(quoted, "@aidemd-mcp", "server", "package.json"), JSON.stringify({ bin: "dist/index.js" }));
		await writeFile(join(quoted, "@aidemd-mcp", "server", "dist", "index.js"), "");
		execState.result = { stdout: `${quoted}\n` };

		await expect(locateEntry()).resolves.toBeNull();
	});
});
