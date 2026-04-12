import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtemp, writeFile, rm, mkdir, access } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import installMethodologyDocs from "./index.js";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");
const METHODOLOGY_ROOT = join(REPO_ROOT, ".aide", "docs");

const METHODOLOGY_FILES = [
	"index.md",
	"aide-spec.md",
	"aide-template.md",
	"progressive-disclosure.md",
	"agent-readable-code.md",
	"automated-qa.md",
	"plan-aide.md",
	"todo-aide.md",
];

let tempDir: string;

beforeEach(async () => {
	tempDir = await mkdtemp(join(tmpdir(), "aide-install-docs-"));
});

afterEach(async () => {
	await rm(tempDir, { recursive: true, force: true });
});

describe("installMethodologyDocs", () => {
	it("returns would-create steps for all docs on a cold run", async () => {
		const hubDir = join(tempDir, ".aide");

		const results = await installMethodologyDocs(hubDir);

		expect(results).toHaveLength(METHODOLOGY_FILES.length);
		expect(results.every((r) => r.status === "would-create")).toBe(true);
		expect(results.map((r) => r.name)).toEqual(
			METHODOLOGY_FILES.map((f) => `.aide/${f}`),
		);
	});

	it("would-create steps carry content matching canonical source", async () => {
		const hubDir = join(tempDir, ".aide");

		const results = await installMethodologyDocs(hubDir);

		for (const result of results) {
			const filename = result.name.replace(".aide/", "");
			const canonical = readFileSync(join(METHODOLOGY_ROOT, filename), "utf-8");
			expect(result.content).toBe(canonical);
		}
	});

	it("returns exists steps for docs that already exist on disk", async () => {
		const hubDir = join(tempDir, ".aide");
		await mkdir(hubDir, { recursive: true });
		await writeFile(join(hubDir, "automated-qa.md"), "# mine\n", "utf-8");

		const results = await installMethodologyDocs(hubDir);

		const byName = new Map(results.map((r) => [r.name, r.status]));
		expect(byName.get(".aide/automated-qa.md")).toBe("exists");
		expect(byName.get(".aide/index.md")).toBe("would-create");
		expect(byName.get(".aide/aide-spec.md")).toBe("would-create");
	});

	it("exists steps have no content field", async () => {
		const hubDir = join(tempDir, ".aide");
		await mkdir(hubDir, { recursive: true });
		await writeFile(join(hubDir, "aide-spec.md"), "# custom\n", "utf-8");

		const results = await installMethodologyDocs(hubDir);

		const spec = results.find((r) => r.name === ".aide/aide-spec.md");
		expect(spec?.status).toBe("exists");
		expect(spec?.content).toBeUndefined();
	});

	it("category is 'methodology' for all steps", async () => {
		const hubDir = join(tempDir, ".aide");

		const results = await installMethodologyDocs(hubDir);

		expect(results.every((r) => r.category === "methodology")).toBe(true);
	});

	it("never writes to disk", async () => {
		const hubDir = join(tempDir, ".aide");

		await installMethodologyDocs(hubDir);

		await expect(access(hubDir)).rejects.toThrow();
	});

	it("does not cascade when one canonical doc read fails — returns would-skip for that entry", async () => {
		const hubDir = join(tempDir, ".aide");
		const failingCanonical = "progressive-disclosure";

		vi.resetModules();
		vi.doMock("@/tools/init/initContent/index.js", async () => {
			const actual = await vi.importActual<typeof import("@/tools/init/initContent/index.js")>(
				"@/tools/init/initContent/index.js",
			);
			return {
				...actual,
				readCanonicalDoc: (name: string) => {
					if (name === failingCanonical) {
						throw new Error(`initContent: canonical doc "${name}" not readable`);
					}
					return `mocked content for ${name}\n`;
				},
			};
		});

		const { default: installFresh } = await import("./index.js");
		const results = await installFresh(hubDir);

		const byName = new Map(results.map((r) => [r.name, r.status]));
		expect(byName.get(".aide/progressive-disclosure.md")).toBe("would-skip");
		expect(byName.get(".aide/index.md")).toBe("would-create");
		expect(byName.get(".aide/aide-spec.md")).toBe("would-create");

		vi.doUnmock("@/tools/init/initContent/index.js");
		vi.resetModules();
	});
});
