import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtemp, writeFile, readdir, readFile, rm, mkdir } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import scaffoldCommands from "./index.js";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");
const DOCS_ROOT = join(REPO_ROOT, "docs");

let tempDir: string;

beforeEach(async () => {
	tempDir = await mkdtemp(join(tmpdir(), "aide-scaffold-"));
});

afterEach(async () => {
	await rm(tempDir, { recursive: true, force: true });
});

describe("scaffoldCommands", () => {
	it("creates all 5 command files under the aide/ namespace subfolder", async () => {
		const commandDir = join(tempDir, "commands");

		const results = await scaffoldCommands(commandDir);

		const files = await readdir(join(commandDir, "aide"));
		expect(files).toContain("research.md");
		expect(files).toContain("spec.md");
		expect(files).toContain("build.md");
		expect(files).toContain("qa.md");
		expect(files).toContain("fix.md");
		expect(results.every((r) => r.status === "created")).toBe(true);
		expect(results.map((r) => r.name)).toEqual([
			"aide:research",
			"aide:spec",
			"aide:build",
			"aide:qa",
			"aide:fix",
		]);
	});

	it("writes each command byte-identical to its canonical doc", async () => {
		const commandDir = join(tempDir, "commands");

		await scaffoldCommands(commandDir);

		const phases = ["research", "spec", "build", "qa", "fix"];
		for (const phase of phases) {
			const installed = await readFile(join(commandDir, "aide", `${phase}.md`), "utf-8");
			const canonical = readFileSync(join(DOCS_ROOT, "commands", "aide", `${phase}.md`), "utf-8");
			expect(installed).toBe(canonical);
		}
	});

	it("leaves existing command files untouched", async () => {
		const commandDir = join(tempDir, "commands");
		await scaffoldCommands(commandDir);
		const customContent = "# Customized\n";
		await writeFile(join(commandDir, "aide", "build.md"), customContent, "utf-8");

		const results = await scaffoldCommands(commandDir);

		const contents = await readFile(join(commandDir, "aide", "build.md"), "utf-8");
		expect(contents).toBe(customContent);
		expect(results.find((r) => r.name === "aide:build")?.status).toBe("exists");
	});

	it("reports exists independently per command on a mixed run", async () => {
		const commandDir = join(tempDir, "commands");
		await mkdir(join(commandDir, "aide"), { recursive: true });
		await writeFile(join(commandDir, "aide", "qa.md"), "# mine\n", "utf-8");

		const results = await scaffoldCommands(commandDir);

		const byName = new Map(results.map((r) => [r.name, r.status]));
		expect(byName.get("aide:qa")).toBe("exists");
		expect(byName.get("aide:research")).toBe("created");
		expect(byName.get("aide:spec")).toBe("created");
		expect(byName.get("aide:build")).toBe("created");
		expect(byName.get("aide:fix")).toBe("created");
	});

	// Pins scaffoldCommands/.aide outcomes.undesired[4]: "a run that fails the
	// whole step if one command template is missing". A failed canonical read
	// for one phase must surface as `skipped` on its own entry while the other
	// four phases still land successfully. No cascade, no short-circuit.
	it("does not cascade when one canonical template read fails", async () => {
		const commandDir = join(tempDir, "commands");
		const failingCanonical = "commands/aide/build";

		// vi.doMock + resetModules + dynamic import scopes the mock to this
		// test only. A top-level vi.mock would poison the sibling tests that
		// need the real readCanonicalDoc. vi.spyOn on fs.readFileSync would be
		// bypassed by initContent's module-scoped cache once any prior test
		// in the process has populated it.
		vi.resetModules();
		vi.doMock("@/tools/init/initContent/index.js", () => ({
			readCanonicalDoc: (name: string) => {
				if (name === failingCanonical) {
					throw new Error(`initContent: canonical doc "${name}" not readable`);
				}
				return `mocked content for ${name}\n`;
			},
		}));

		const { default: scaffoldCommandsFresh } = await import("./index.js");
		const results = await scaffoldCommandsFresh(commandDir);

		expect(results).toHaveLength(5);
		expect(results.map((r) => r.name)).toEqual([
			"aide:research",
			"aide:spec",
			"aide:build",
			"aide:qa",
			"aide:fix",
		]);

		const byName = new Map(results.map((r) => [r.name, r.status]));
		expect(byName.get("aide:build")).toBe("skipped");
		expect(byName.get("aide:research")).toBe("created");
		expect(byName.get("aide:spec")).toBe("created");
		expect(byName.get("aide:qa")).toBe("created");
		expect(byName.get("aide:fix")).toBe("created");

		for (const phase of ["research", "spec", "qa", "fix"]) {
			const contents = await readFile(
				join(commandDir, "aide", `${phase}.md`),
				"utf-8",
			);
			expect(contents).toBe(`mocked content for commands/aide/${phase}\n`);
		}

		await expect(
			readFile(join(commandDir, "aide", "build.md"), "utf-8"),
		).rejects.toThrow();

		vi.doUnmock("@/tools/init/initContent/index.js");
		vi.resetModules();
	});
});
