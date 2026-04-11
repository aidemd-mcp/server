import { readFileSync, renameSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";
import { getMethodologyMarker, readCanonicalDoc } from "./index.js";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");
const DOCS_ROOT = join(REPO_ROOT, "docs");

describe("readCanonicalDoc", () => {
	it("returns disk bytes verbatim for aide-spec", () => {
		const onDisk = readFileSync(join(DOCS_ROOT, "aide-spec.md"), "utf-8");
		expect(readCanonicalDoc("aide-spec")).toBe(onDisk);
	});

	it("returns disk bytes verbatim for a command template", () => {
		const onDisk = readFileSync(join(DOCS_ROOT, "commands", "aide", "research.md"), "utf-8");
		expect(readCanonicalDoc("commands/aide/research")).toBe(onDisk);
	});

	/**
	 * Regression guard for initContent/.aide outcomes.undesired #3 ("silent
	 * fallback to hardcoded content"). If a future refactor introduces a
	 * catch-and-return-default path for missing docs, the helper would stop
	 * throwing and this test would fail — making the regression visible at
	 * CI time instead of silently shipping invented content as canonical.
	 *
	 * We temporarily rename one canonical doc file on disk so the underlying
	 * readFileSync raises ENOENT, then assert that readCanonicalDoc surfaces
	 * an error naming both the canonical name and the resolved path, and
	 * restore the file in a finally block regardless of outcome. The doc
	 * chosen (`automated-qa`) must not have been read earlier in this file —
	 * readCanonicalDoc caches successful reads module-wide, and a cached
	 * entry would short-circuit the catch path we are trying to exercise.
	 */
	it("throws a loud error naming the canonical name when the doc is unreadable", () => {
		const original = join(DOCS_ROOT, "automated-qa.md");
		const sidelined = join(DOCS_ROOT, "automated-qa.md.missing-for-test");
		renameSync(original, sidelined);
		try {
			expect(() => readCanonicalDoc("automated-qa")).toThrow(/automated-qa/);
			expect(() => readCanonicalDoc("automated-qa")).toThrow(/not readable/);
		} finally {
			renameSync(sidelined, original);
		}
	});
});

describe("getMethodologyMarker", () => {
	it("is byte-stable — changing it would break idempotency on every existing install", () => {
		expect(getMethodologyMarker()).toBe("<!-- aide-methodology -->");
	});
});

