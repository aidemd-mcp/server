import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtemp, writeFile, rm, mkdir, access } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import reference from "./index.js";
import { getCanonicalPath, listReferencePages } from "@/service/install/initContent/index.js";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");
const DOC_HUB_DIR = ".aide/docs";

// ---------------------------------------------------------------------------
// Factory helpers
// ---------------------------------------------------------------------------

function makeInput(projectRoot: string) {
	return { projectRoot, docHubDir: DOC_HUB_DIR };
}

function readCanonicalBytes(canonical: Parameters<typeof getCanonicalPath>[0]): string {
	return readFileSync(join(REPO_ROOT, getCanonicalPath(canonical)), "utf-8");
}

async function writeAllPages(projectRoot: string): Promise<void> {
	for (const entry of listReferencePages()) {
		const filePath = join(projectRoot, ".aide", "reference", entry.hostPath);
		await mkdir(dirname(filePath), { recursive: true });
		await writeFile(filePath, readCanonicalBytes(entry.canonical), "utf-8");
	}
}

// ---------------------------------------------------------------------------
// Temp dir lifecycle
// ---------------------------------------------------------------------------

let tempDir: string;

beforeEach(async () => {
	tempDir = await mkdtemp(join(tmpdir(), "aide-install-reference-"));
});

afterEach(async () => {
	await rm(tempDir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// Behaviour
// ---------------------------------------------------------------------------

describe("reference", () => {
	it("fresh project: one would-create step per shipped page", async () => {
		const pages = listReferencePages();

		const steps = await reference(makeInput(tempDir));

		expect(steps).toHaveLength(pages.length);
		pages.forEach((entry, index) => {
			const step = steps[index];
			expect(step.status).toBe("would-create");
			expect(step.category).toBe("reference");
			expect(step.content).toBe(readCanonicalBytes(entry.canonical));
		});
	});

	it("pages land in their set under the doc hub's parent", async () => {
		const pages = listReferencePages();

		const steps = await reference(makeInput(tempDir));

		pages.forEach((entry, index) => {
			expect(steps[index].filePath).toBe(join(tempDir, ".aide", "reference", entry.hostPath));
		});
		for (const step of steps) {
			expect(
				step.name.startsWith(".aide/reference/tools/") ||
					step.name.startsWith(".aide/reference/hooks/"),
			).toBe(true);
		}
	});

	it("identical page is exists", async () => {
		await writeAllPages(tempDir);

		const steps = await reference(makeInput(tempDir));

		expect(steps.length).toBe(listReferencePages().length);
		for (const step of steps) {
			expect(step.status).toBe("exists");
			expect(step.content).toBeUndefined();
		}
	});

	it("a drifted page is its own would-overwrite", async () => {
		await writeAllPages(tempDir);
		const pages = listReferencePages();
		const drifted = pages[0];
		await writeFile(
			join(tempDir, ".aide", "reference", drifted.hostPath),
			"# drifted\n",
			"utf-8",
		);

		const steps = await reference(makeInput(tempDir));

		pages.forEach((entry, index) => {
			const step = steps[index];
			if (entry === drifted) {
				expect(step.status).toBe("would-overwrite");
				expect(step.content).toBe(readCanonicalBytes(entry.canonical));
				return;
			}
			expect(step.status).toBe("exists");
		});
	});

	it("one unreadable page skips only itself", async () => {
		const pages = listReferencePages();
		const failing = pages[0];

		vi.resetModules();
		vi.doMock("@/service/install/initContent/index.js", async () => {
			const actual = await vi.importActual<
				typeof import("@/service/install/initContent/index.js")
			>("@/service/install/initContent/index.js");
			return {
				...actual,
				readCanonicalDoc: (name: Parameters<typeof actual.readCanonicalDoc>[0]) => {
					if (name === failing.canonical) {
						throw new Error(`initContent: canonical doc "${name}" not readable`);
					}
					return actual.readCanonicalDoc(name);
				},
			};
		});

		const { default: referenceFresh } = await import("./index.js");
		const steps = await referenceFresh(makeInput(tempDir));

		vi.doUnmock("@/service/install/initContent/index.js");
		vi.resetModules();

		expect(steps).toHaveLength(pages.length);
		pages.forEach((entry, index) => {
			const step = steps[index];
			if (entry === failing) {
				expect(step.status).toBe("would-skip");
				expect(step.content).toBeUndefined();
				return;
			}
			expect(step.status).toBe("would-create");
		});
	});

	it("no step is in the methodology category", async () => {
		const steps = await reference(makeInput(tempDir));

		expect(steps.some((step) => step.category === "methodology")).toBe(false);
	});

	it("never writes", async () => {
		await reference(makeInput(tempDir));

		await expect(access(join(tempDir, ".aide", "reference"))).rejects.toThrow();
	});
});
