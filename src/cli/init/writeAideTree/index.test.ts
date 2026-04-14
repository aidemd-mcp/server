import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import writeAideTree from "./index.js";
import { readCanonicalDoc } from "@/tools/init/initContent/index.js";

let tempDir: string;

beforeEach(async () => {
	tempDir = await mkdtemp(join(tmpdir(), "aide-writeaidetree-"));
});

afterEach(async () => {
	await rm(tempDir, { recursive: true, force: true });
});

describe("writeAideTree", () => {
	it("writes the launcher file when it does not exist and content matches readCanonicalDoc", async () => {
		const result = await writeAideTree(tempDir);

		expect(result.status).toBe("created");

		const launcherPath = join(tempDir, ".aide", "bin", "aide-tree.mjs");
		const written = await readFile(launcherPath, "utf-8");
		const expected = readCanonicalDoc("bin/aide-tree");

		expect(written).toBe(expected);
	});

	it("creates the full parent directory tree when it does not exist", async () => {
		// The tempDir has no .aide/bin/ hierarchy — confirm it is
		// created successfully without throwing
		const result = await writeAideTree(tempDir);

		expect(result.status).toBe("created");

		const launcherPath = join(tempDir, ".aide", "bin", "aide-tree.mjs");
		// readFile throws if the file or any ancestor dir was not created
		const written = await readFile(launcherPath, "utf-8");
		expect(written.length).toBeGreaterThan(0);
	});

	it("returns exists without modifying the file when it already exists on disk", async () => {
		const launcherPath = join(tempDir, ".aide", "bin", "aide-tree.mjs");

		// Pre-create the directory tree and the file with sentinel content
		const { mkdir } = await import("node:fs/promises");
		await mkdir(join(tempDir, ".aide", "bin"), { recursive: true });
		const sentinel = "# existing content — must not be overwritten";
		await writeFile(launcherPath, sentinel, "utf-8");

		const result = await writeAideTree(tempDir);

		expect(result.status).toBe("exists");

		// File content must be unchanged
		const after = await readFile(launcherPath, "utf-8");
		expect(after).toBe(sentinel);
	});
});
