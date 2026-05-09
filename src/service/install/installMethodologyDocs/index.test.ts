import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtemp, writeFile, rm, mkdir, access } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import installMethodologyDocs from "./index.js";
import type { InitStep } from "@/types/index.js";

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
	"brief-aide.md",
	"session-aide.md",
	"brain-aide.md",
	"cascading-alignment.md",
];

// ---------------------------------------------------------------------------
// Factory helpers
// ---------------------------------------------------------------------------

function makeWouldCreate(filename: string, content: string): Partial<InitStep> {
	return { status: "would-create", name: `.aide/${filename}`, category: "methodology", content };
}

function makeExists(filename: string): Partial<InitStep> {
	return { status: "exists", name: `.aide/${filename}`, category: "methodology" };
}

function makeWouldOverwrite(filename: string, content: string): Partial<InitStep> {
	return { status: "would-overwrite", name: `.aide/${filename}`, category: "methodology", content };
}

// ---------------------------------------------------------------------------
// Temp dir lifecycle
// ---------------------------------------------------------------------------

let tempDir: string;

beforeEach(async () => {
	tempDir = await mkdtemp(join(tmpdir(), "aide-install-docs-"));
});

afterEach(async () => {
	await rm(tempDir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// Core behaviour
// ---------------------------------------------------------------------------

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

	it("returns exists when a doc on disk is byte-identical to canonical", async () => {
		const hubDir = join(tempDir, ".aide");
		await mkdir(hubDir, { recursive: true });

		const canonicalContent = readFileSync(join(METHODOLOGY_ROOT, "automated-qa.md"), "utf-8");
		await writeFile(join(hubDir, "automated-qa.md"), canonicalContent, "utf-8");

		const results = await installMethodologyDocs(hubDir);

		const byName = new Map(results.map((r) => [r.name, r]));
		const step = byName.get(".aide/automated-qa.md")!;
		expect(step.status).toBe("exists");
		expect(step.content).toBeUndefined();
		expect(byName.get(".aide/index.md")!.status).toBe("would-create");
		expect(byName.get(".aide/aide-spec.md")!.status).toBe("would-create");
	});

	it("returns would-overwrite when a doc on disk has drifted from canonical", async () => {
		const hubDir = join(tempDir, ".aide");
		await mkdir(hubDir, { recursive: true });
		await writeFile(join(hubDir, "automated-qa.md"), "# mine\n", "utf-8");

		const results = await installMethodologyDocs(hubDir);

		const byName = new Map(results.map((r) => [r.name, r]));
		const step = byName.get(".aide/automated-qa.md")!;
		expect(step.status).toBe("would-overwrite");

		const canonicalContent = readFileSync(join(METHODOLOGY_ROOT, "automated-qa.md"), "utf-8");
		expect(step.content).toBe(canonicalContent);
	});

	it("would-overwrite step carries content matching canonical source", async () => {
		const hubDir = join(tempDir, ".aide");
		await mkdir(hubDir, { recursive: true });
		await writeFile(join(hubDir, "aide-spec.md"), "# drifted content\n", "utf-8");

		const results = await installMethodologyDocs(hubDir);

		const step = results.find((r) => r.name === ".aide/aide-spec.md")!;
		const canonical = readFileSync(join(METHODOLOGY_ROOT, "aide-spec.md"), "utf-8");
		expect(step.status).toBe("would-overwrite");
		expect(step.content).toBe(canonical);
	});

	it("exists steps have no content field", async () => {
		const hubDir = join(tempDir, ".aide");
		await mkdir(hubDir, { recursive: true });

		const canonicalContent = readFileSync(join(METHODOLOGY_ROOT, "aide-spec.md"), "utf-8");
		await writeFile(join(hubDir, "aide-spec.md"), canonicalContent, "utf-8");

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
		vi.doMock("@/service/install/initContent/index.js", async () => {
			const actual = await vi.importActual<typeof import("@/service/install/initContent/index.js")>(
				"@/service/install/initContent/index.js",
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

		vi.doUnmock("@/service/install/initContent/index.js");
		vi.resetModules();
	});
});

// ---------------------------------------------------------------------------
// Parameterized: all three outcome shapes across multiple docs
// ---------------------------------------------------------------------------

describe("installMethodologyDocs — parameterized outcome shapes", () => {
	it.each([
		"index.md",
		"aide-spec.md",
		"plan-aide.md",
		"cascading-alignment.md",
	])("missing %s → would-create with content", async (filename) => {
		const hubDir = join(tempDir, ".aide");

		const results = await installMethodologyDocs(hubDir);
		const step = results.find((r) => r.name === `.aide/${filename}`)!;

		const canonical = readFileSync(join(METHODOLOGY_ROOT, filename), "utf-8");
		expect(step).toMatchObject(makeWouldCreate(filename, canonical));
	});

	it.each([
		"index.md",
		"aide-spec.md",
		"plan-aide.md",
	])("byte-identical %s on disk → exists with no content", async (filename) => {
		const hubDir = join(tempDir, ".aide");
		await mkdir(hubDir, { recursive: true });

		const canonicalContent = readFileSync(join(METHODOLOGY_ROOT, filename), "utf-8");
		await writeFile(join(hubDir, filename), canonicalContent, "utf-8");

		const results = await installMethodologyDocs(hubDir);
		const step = results.find((r) => r.name === `.aide/${filename}`)!;

		expect(step).toMatchObject(makeExists(filename));
	});

	it.each([
		"index.md",
		"aide-spec.md",
		"plan-aide.md",
	])("drifted %s on disk → would-overwrite with canonical content", async (filename) => {
		const hubDir = join(tempDir, ".aide");
		await mkdir(hubDir, { recursive: true });
		await writeFile(join(hubDir, filename), `# stale content for ${filename}\n`, "utf-8");

		const results = await installMethodologyDocs(hubDir);
		const step = results.find((r) => r.name === `.aide/${filename}`)!;

		const canonical = readFileSync(join(METHODOLOGY_ROOT, filename), "utf-8");
		expect(step).toMatchObject(makeWouldOverwrite(filename, canonical));
	});
});
