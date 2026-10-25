import { describe, it, expect } from "vitest";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import scan from "@/util/scan/index.js";
import classifyAideFile from "@/tools/frontmatter/classifyAideFile/index.js";
import readGovernedValue from "@/tools/frontmatter/readGovernedValue/index.js";

/**
 * Guard for this repo's own intent specs. This repo dogfoods the alignment
 * field: every intent spec must record `alignment` with a value from the set,
 * under the current name and not the older `status`, so a spec added without
 * it, or with the older name, fails here. The session record and the brain
 * config carry no governed value and must hold no column-0 `alignment:` or
 * `status:` line.
 */

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const GOVERNED_KEY_LINE = /^(alignment|status):/m;

describe("this repo's intent specs record alignment", () => {
	it("every intent spec holds a set alignment value under the current name", async () => {
		const { files } = await scan(REPO_ROOT);
		const specs = files.filter((f) => classifyAideFile(f.relativePath) === "intent-spec");
		expect(specs.length).toBeGreaterThan(0);

		const failures: string[] = [];
		for (const spec of specs) {
			const content = await readFile(spec.path, "utf8");
			const read = readGovernedValue({ content, kind: "intent-spec" });
			if (read.status !== "ok") {
				failures.push(`${spec.relativePath}: frontmatter is unparsable (${read.detail})`);
			} else if (read.current.state !== "set") {
				failures.push(`${spec.relativePath}: alignment is ${read.current.state}`);
			} else if (read.legacy) {
				failures.push(`${spec.relativePath}: uses the older name status`);
			} else if (read.ambiguous) {
				failures.push(`${spec.relativePath}: holds both alignment and status`);
			}
		}
		expect(failures).toEqual([]);
	}, 30000);

	it.each([".aide/session.aide", ".aide/config/brain.aide"])(
		"%s holds no column-0 alignment or status line",
		async (relativePath) => {
			const content = await readFile(join(REPO_ROOT, relativePath), "utf8");
			expect(content).not.toMatch(GOVERNED_KEY_LINE);
		},
	);
});
