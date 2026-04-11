import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { classifyFile, detectAnomalies } from "./index.js";
import type { AideFile } from "@/types/index.js";

function makeAideFile(overrides: Partial<AideFile> & { path: string; relativePath: string }): AideFile {
	return {
		type: classifyFile(overrides.relativePath.split("/").pop()!),
		summary: "",
		...overrides,
	};
}

describe("classifyFile", () => {
	it.each([
		[".aide", "intent"],
		["intent.aide", "intent"],
		["research.aide", "research"],
		["todo.aide", "todo"],
	] as const)("classifies %s as %s", (filename, expected) => {
		expect(classifyFile(filename)).toBe(expected);
	});
});

describe("detectAnomalies", () => {
	let tempDir: string;

	beforeEach(async () => {
		tempDir = await mkdtemp(join(tmpdir(), "aide-classify-"));
	});

	afterEach(async () => {
		await rm(tempDir, { recursive: true, force: true });
	});

	it("detects naming-conflict when .aide and intent.aide coexist", async () => {
		await writeFile(join(tempDir, ".aide"), "intent");
		await writeFile(join(tempDir, "intent.aide"), "also intent");
		await writeFile(join(tempDir, "index.ts"), "export default function() {}");

		const files: AideFile[] = [
			makeAideFile({ path: join(tempDir, ".aide"), relativePath: "src/.aide" }),
			makeAideFile({ path: join(tempDir, "intent.aide"), relativePath: "src/intent.aide" }),
		];

		const warnings = await detectAnomalies(files, tempDir);
		const conflict = warnings.find((w) => w.kind === "naming-conflict");

		expect(conflict).toBeDefined();
		expect(conflict!.message).toContain(".aide and intent.aide");
	});

	it("detects orphaned-research without intent spec", async () => {
		await writeFile(join(tempDir, "index.ts"), "export default function() {}");

		const files: AideFile[] = [
			makeAideFile({ path: join(tempDir, "research.aide"), relativePath: "src/research.aide" }),
		];

		const warnings = await detectAnomalies(files, tempDir);
		const orphaned = warnings.find((w) => w.kind === "orphaned-research");

		expect(orphaned).toBeDefined();
	});

	it("detects orphaned-spec in folder with no orchestrator", async () => {
		// No index.ts in tempDir
		const files: AideFile[] = [
			makeAideFile({ path: join(tempDir, ".aide"), relativePath: "src/.aide" }),
		];

		const warnings = await detectAnomalies(files, tempDir);
		const orphaned = warnings.find((w) => w.kind === "orphaned-spec");

		expect(orphaned).toBeDefined();
	});

	it("does not flag orphaned-spec when orchestrator exists", async () => {
		await writeFile(join(tempDir, "index.ts"), "export default function() {}");

		const files: AideFile[] = [
			makeAideFile({ path: join(tempDir, ".aide"), relativePath: "src/.aide" }),
		];

		const warnings = await detectAnomalies(files, tempDir);
		const orphaned = warnings.find((w) => w.kind === "orphaned-spec");

		expect(orphaned).toBeUndefined();
	});

	it("detects missing-spec on orchestrator with 3+ imports", async () => {
		const subDir = join(tempDir, "module");
		await mkdir(subDir, { recursive: true });
		await writeFile(
			join(subDir, "index.ts"),
			`import a from "./helperA/index.js";
import b from "./helperB/index.js";
import c from "./helperC/index.js";
export default function() { return a() + b() + c(); }`,
		);

		// No .aide in subDir — should be flagged
		const files: AideFile[] = [];
		const warnings = await detectAnomalies(files, tempDir);
		const missing = warnings.find((w) => w.kind === "missing-spec");

		expect(missing).toBeDefined();
		expect(missing!.message).toContain("3 helper imports");
	});
});
