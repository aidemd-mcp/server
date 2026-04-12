import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtemp, writeFile, readdir, readFile, rm, mkdir } from "node:fs/promises";
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
	it("installs every canonical methodology doc on a cold run", async () => {
		const hubDir = join(tempDir, ".aide");

		const results = await installMethodologyDocs(hubDir);

		const files = await readdir(hubDir);
		for (const f of METHODOLOGY_FILES) expect(files).toContain(f);

		expect(results).toHaveLength(METHODOLOGY_FILES.length);
		expect(results.every((r) => r.status === "created")).toBe(true);
		expect(results.map((r) => r.name)).toEqual(
			METHODOLOGY_FILES.map((f) => `.aide/${f}`),
		);
	});

	it("writes each canonical doc byte-identical to its source under .aide/docs/", async () => {
		const hubDir = join(tempDir, ".aide");

		await installMethodologyDocs(hubDir);

		for (const f of METHODOLOGY_FILES) {
			const installed = await readFile(join(hubDir, f), "utf-8");
			const canonical = readFileSync(join(METHODOLOGY_ROOT, f), "utf-8");
			expect(installed).toBe(canonical);
		}
	});

	it("preserves an existing methodology doc verbatim across re-runs", async () => {
		const hubDir = join(tempDir, ".aide");
		await installMethodologyDocs(hubDir);
		const customContent = "# my custom take on aide-spec\n";
		await writeFile(join(hubDir, "aide-spec.md"), customContent, "utf-8");

		const results = await installMethodologyDocs(hubDir);

		const preserved = await readFile(join(hubDir, "aide-spec.md"), "utf-8");
		expect(preserved).toBe(customContent);
		expect(results.find((r) => r.name === ".aide/aide-spec.md")?.status).toBe("exists");
	});

	it("reports per-file statuses independently on a mixed run", async () => {
		const hubDir = join(tempDir, ".aide");
		await mkdir(hubDir, { recursive: true });
		await writeFile(join(hubDir, "automated-qa.md"), "# mine\n", "utf-8");

		const results = await installMethodologyDocs(hubDir);

		const byName = new Map(results.map((r) => [r.name, r.status]));
		expect(byName.get(".aide/automated-qa.md")).toBe("exists");
		expect(byName.get(".aide/index.md")).toBe("created");
		expect(byName.get(".aide/aide-spec.md")).toBe("created");
		expect(byName.get(".aide/aide-template.md")).toBe("created");
		expect(byName.get(".aide/progressive-disclosure.md")).toBe("created");
		expect(byName.get(".aide/agent-readable-code.md")).toBe("created");
	});

	// Pins installMethodologyDocs/.aide outcomes.undesired: "an install run
	// that aborts the whole helper if one canonical doc is unreadable". A
	// failed canonical read for one doc must surface as `skipped` on its
	// own entry while the other four docs (and the hub index) still land.
	it("does not cascade when one canonical doc read fails", async () => {
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
		expect(byName.get(".aide/progressive-disclosure.md")).toBe("skipped");
		expect(byName.get(".aide/index.md")).toBe("created");
		expect(byName.get(".aide/aide-spec.md")).toBe("created");
		expect(byName.get(".aide/aide-template.md")).toBe("created");
		expect(byName.get(".aide/agent-readable-code.md")).toBe("created");
		expect(byName.get(".aide/automated-qa.md")).toBe("created");

		await expect(
			readFile(join(hubDir, "progressive-disclosure.md"), "utf-8"),
		).rejects.toThrow();

		vi.doUnmock("@/tools/init/initContent/index.js");
		vi.resetModules();
	});
});
