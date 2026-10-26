import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { join, dirname } from "node:path";
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

const ORPHANED_SPEC_MESSAGE =
	"Spec has nothing to govern: this folder and its subfolders hold no code (only AIDE files, Markdown and dot-files).";

/** Writes each relative path under root as an empty file, creating parent folders. */
async function writeTree(root: string, paths: string[]): Promise<void> {
	for (const rel of paths) {
		await mkdir(dirname(join(root, rel)), { recursive: true });
		await writeFile(join(root, rel), "x");
	}
}

describe("detectAnomalies", () => {
	let tempDir: string;

	/** Runs detectAnomalies for aide files that sit directly in tempDir (reported as folder "src"). */
	async function orphanedSpecsFor(names: string[]) {
		const files = names.map((name) =>
			makeAideFile({ path: join(tempDir, name), relativePath: `src/${name}` }),
		);
		const warnings = await detectAnomalies(files, tempDir);
		return warnings.filter((w) => w.kind === "orphaned-spec");
	}

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

	it("detects orphaned-spec in a folder that holds no code", async () => {
		// No code anywhere in tempDir
		const files: AideFile[] = [
			makeAideFile({ path: join(tempDir, ".aide"), relativePath: "src/.aide" }),
		];

		const warnings = await detectAnomalies(files, tempDir);
		const orphaned = warnings.find((w) => w.kind === "orphaned-spec");

		expect(orphaned).toBeDefined();
		expect(orphaned!.path).toBe("src");
		expect(orphaned!.message).toBe(ORPHANED_SPEC_MESSAGE);
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

	it("does not flag a spec whose code is only in subfolders", async () => {
		await writeTree(tempDir, [".aide", "helperA/index.ts", "helperB/index.ts"]);
		expect(await orphanedSpecsFor([".aide"])).toEqual([]);
	});

	it("does not flag a spec beside a non-index source file in another language", async () => {
		await writeTree(tempDir, [".aide", "run.py"]);
		expect(await orphanedSpecsFor([".aide"])).toEqual([]);
	});

	it("does not flag a spec beside a non-index TypeScript file", async () => {
		await writeTree(tempDir, [".aide", "types.ts"]);
		expect(await orphanedSpecsFor([".aide"])).toEqual([]);
	});

	it("flags a spec beside only AIDE files and Markdown", async () => {
		await writeTree(tempDir, [".aide", "plan.aide", "README.md"]);
		const orphaned = await orphanedSpecsFor([".aide", "plan.aide"]);
		expect(orphaned).toHaveLength(1);
		expect(orphaned[0].message).toBe(ORPHANED_SPEC_MESSAGE);
	});

	it("flags intent.aide alone in a codeless folder", async () => {
		await writeTree(tempDir, ["intent.aide"]);
		expect(await orphanedSpecsFor(["intent.aide"])).toHaveLength(1);
	});

	it("flags a spec whose only code sits in skipped folders", async () => {
		await writeTree(tempDir, [".aide", "node_modules/x.js", ".cache/y.js"]);
		expect(await orphanedSpecsFor([".aide"])).toHaveLength(1);
	});

	it.each([
		["the orchestrator case", ["index.ts"]],
		["code only in subfolders", ["helperA/index.ts", "helperB/index.ts"]],
		["a non-index file in another language", ["run.py"]],
		["only AIDE files and Markdown", ["README.md"]],
	])("gives the same orphaned-spec answer with and without a plan: %s", async (_label, layout) => {
		await writeTree(tempDir, [".aide", ...layout]);
		const without = await orphanedSpecsFor([".aide"]);

		await writeTree(tempDir, ["plan.aide"]);
		const withPlan = await orphanedSpecsFor([".aide", "plan.aide"]);

		expect(withPlan).toEqual(without);
	});

	it("does not flag a codeless folder holding only plan.aide", async () => {
		await writeTree(tempDir, ["plan.aide"]);
		expect(await orphanedSpecsFor(["plan.aide"])).toEqual([]);
	});

	it("reports only orphaned-research for a codeless folder holding only research.aide", async () => {
		await writeTree(tempDir, ["research.aide"]);
		const files = [
			makeAideFile({ path: join(tempDir, "research.aide"), relativePath: "src/research.aide" }),
		];
		const warnings = await detectAnomalies(files, tempDir);

		expect(warnings.some((w) => w.kind === "orphaned-research")).toBe(true);
		expect(warnings.some((w) => w.kind === "orphaned-spec")).toBe(false);
	});

	it.each(["brain.aide", "session.aide"])("does not flag a codeless folder holding only %s", async (name) => {
		await writeTree(tempDir, [name]);
		expect(await orphanedSpecsFor([name])).toEqual([]);
	});

	it("flags a spec beside only a dot-file", async () => {
		await writeTree(tempDir, [".aide", ".DS_Store"]);
		expect(await orphanedSpecsFor([".aide"])).toHaveLength(1);
	});

	it("exempts the root intent folder <root>/.aide", async () => {
		await writeTree(tempDir, [
			".aide/intent.aide",
			".aide/session.aide",
			".aide/docs/guide.md",
			".aide/config/brain.aide",
		]);
		const files = [
			makeAideFile({
				path: join(tempDir, ".aide", "intent.aide"),
				relativePath: ".aide/intent.aide",
			}),
		];

		const warnings = await detectAnomalies(files, tempDir);

		expect(warnings.filter((w) => w.kind === "orphaned-spec")).toEqual([]);
	});

	it("does not exempt a nested .aide folder", async () => {
		await writeTree(tempDir, ["src/x/.aide/intent.aide"]);
		const files = [
			makeAideFile({
				path: join(tempDir, "src", "x", ".aide", "intent.aide"),
				relativePath: "src/x/.aide/intent.aide",
			}),
		];

		const warnings = await detectAnomalies(files, tempDir);
		const orphaned = warnings.filter((w) => w.kind === "orphaned-spec");

		expect(orphaned).toHaveLength(1);
		expect(orphaned[0].path).toBe("src/x/.aide");
	});
});
