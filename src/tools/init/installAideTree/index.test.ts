import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtemp, writeFile, rm, mkdir, access } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import installAideTree from "./index.js";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");
const CANONICAL_PATH = join(REPO_ROOT, ".aide", "bin", "aide-tree.mjs");

let tempDir: string;

beforeEach(async () => {
	tempDir = await mkdtemp(join(tmpdir(), "aide-install-aide-tree-"));
});

afterEach(async () => {
	await rm(tempDir, { recursive: true, force: true });
});

describe("installAideTree", () => {
	it("returns a single would-create step when the file is absent", async () => {
		const results = await installAideTree(tempDir);

		expect(results).toHaveLength(1);
		expect(results[0]?.status).toBe("would-create");
		expect(results[0]?.name).toBe(".aide/bin/aide-tree.mjs");
		expect(results[0]?.category).toBe("commands");
	});

	it("would-create step carries content matching the canonical source", async () => {
		const results = await installAideTree(tempDir);

		const canonical = readFileSync(CANONICAL_PATH, "utf-8");
		expect(results[0]?.content).toBe(canonical);
	});

	it("returns exists when the file is already present on disk", async () => {
		const binDir = join(tempDir, ".aide", "bin");
		await mkdir(binDir, { recursive: true });
		await writeFile(join(binDir, "aide-tree.mjs"), "// custom\n", "utf-8");

		const results = await installAideTree(tempDir);

		expect(results).toHaveLength(1);
		expect(results[0]?.status).toBe("exists");
		expect(results[0]?.name).toBe(".aide/bin/aide-tree.mjs");
		expect(results[0]?.category).toBe("commands");
	});

	it("exists step has no content field", async () => {
		const binDir = join(tempDir, ".aide", "bin");
		await mkdir(binDir, { recursive: true });
		await writeFile(join(binDir, "aide-tree.mjs"), "// custom\n", "utf-8");

		const results = await installAideTree(tempDir);

		expect(results[0]?.content).toBeUndefined();
	});

	it("never writes to disk", async () => {
		const binDir = join(tempDir, ".aide", "bin");

		await installAideTree(tempDir);

		await expect(access(binDir)).rejects.toThrow();
	});

	it("returns would-skip when readCanonicalDoc throws", async () => {
		vi.resetModules();
		vi.doMock("@/tools/init/initContent/index.js", () => ({
			readCanonicalDoc: (_name: string) => {
				throw new Error('initContent: canonical doc "bin/aide-tree" not readable');
			},
		}));

		const { default: installAideTreeFresh } = await import("./index.js");
		const results = await installAideTreeFresh(tempDir);

		expect(results).toHaveLength(1);
		expect(results[0]?.status).toBe("would-skip");
		expect(results[0]?.name).toBe(".aide/bin/aide-tree.mjs");
		expect(results[0]?.category).toBe("commands");
		expect(results[0]?.content).toBeUndefined();

		vi.doUnmock("@/tools/init/initContent/index.js");
		vi.resetModules();
	});
});
