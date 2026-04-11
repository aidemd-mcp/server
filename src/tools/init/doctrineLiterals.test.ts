import { describe, it, expect } from "vitest";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Cross-cutting regression guard for the init subtree.
 *
 * The four init helpers scanned below — writeMethodology, scaffoldCommands,
 * initContent, and installMethodologyDocs — all have `.aide` specs whose
 * `outcomes.undesired` section explicitly forbids AIDE doctrine living as a
 * string literal in the helper's source. See:
 *   - src/tools/init/writeMethodology/.aide        (outcomes.undesired[1])
 *   - src/tools/init/scaffoldCommands/.aide        (outcomes.undesired[0])
 *   - src/tools/init/initContent/.aide             (outcomes.undesired[3])
 *   - src/tools/init/installMethodologyDocs/.aide  (outcomes.undesired about
 *                                                    hub index doctrine)
 * And the parent invariants in src/.aide ("no AIDE doctrine as string literals
 * in this submodule's source") and .aide (canonical docs are the single
 * source of truth).
 *
 * The matcher scans each file's tokenized string literals (single, double,
 * and backtick) AFTER stripping line and block comments — JSDoc blocks in
 * these files legitimately quote spec prose for reader context, and a raw
 * regex would false-positive on them. Any literal longer than 200 characters
 * that contains "aide", ".aide", or "pipeline" (case-insensitive) is flagged.
 *
 * The 200-char threshold is load-bearing: it comfortably excludes framework
 * plumbing like METHODOLOGY_MARKER ("<!-- aide-methodology -->", 25 chars)
 * and the canonical-name keys in initContent (e.g. "commands/aide/research")
 * while being well below the length of any real doctrine paragraph.
 *
 * Concatenation with `+` is NOT currently tracked across string literals;
 * a future regression that splits a 400-char blob into two 200-char halves
 * joined with `+` would sneak past this guard. Tracked as a follow-up:
 * if this matcher is extended to other files (discover, aide_init, types),
 * add a pass that folds `"..." + "..."` sequences into one logical literal
 * before length-checking.
 */

const MODULE_DIR = dirname(fileURLToPath(import.meta.url));

const GUARDED_FILES = [
	join(MODULE_DIR, "writeMethodology", "index.ts"),
	join(MODULE_DIR, "scaffoldCommands", "index.ts"),
	join(MODULE_DIR, "initContent", "index.ts"),
	join(MODULE_DIR, "installMethodologyDocs", "index.ts"),
];

const DOCTRINE_THRESHOLD = 200;
const DOCTRINE_TRIGGER = /aide|\.aide|pipeline/i;

interface ExtractedLiteral {
	/** 1-based line number where the literal opens. */
	line: number;
	/** The string content between (but not including) the quote delimiters. */
	content: string;
}

/**
 * Walk the source character-by-character, skipping comments, and collect every
 * string literal (single-quoted, double-quoted, template). This is a small
 * hand-rolled scanner rather than a TypeScript AST parser to keep dev-deps
 * at zero — Node's fs + a scanner is enough for the three files in scope.
 *
 * Known limitations: does not follow ${...} interpolation inside templates
 * (ok because none of the three scanned files currently use it), does not
 * fold `"a" + "b"` concat across literals (see file-level JSDoc).
 */
function extractStringLiterals(source: string): ExtractedLiteral[] {
	const literals: ExtractedLiteral[] = [];
	let i = 0;
	let line = 1;
	const len = source.length;

	while (i < len) {
		const ch = source[i];
		const next = source[i + 1];

		if (ch === "\n") {
			line++;
			i++;
			continue;
		}

		// Line comment: //...\n
		if (ch === "/" && next === "/") {
			while (i < len && source[i] !== "\n") i++;
			continue;
		}

		// Block comment: /* ... */ (includes JSDoc)
		if (ch === "/" && next === "*") {
			i += 2;
			while (i < len && !(source[i] === "*" && source[i + 1] === "/")) {
				if (source[i] === "\n") line++;
				i++;
			}
			i += 2;
			continue;
		}

		// String literal: ' or "
		if (ch === "'" || ch === '"') {
			const quote = ch;
			const startLine = line;
			i++;
			let content = "";
			while (i < len && source[i] !== quote) {
				if (source[i] === "\\" && i + 1 < len) {
					content += source[i] + source[i + 1];
					i += 2;
					continue;
				}
				if (source[i] === "\n") line++;
				content += source[i];
				i++;
			}
			i++; // closing quote
			literals.push({ line: startLine, content });
			continue;
		}

		// Template literal: `...` (may span multiple lines)
		if (ch === "`") {
			const startLine = line;
			i++;
			let content = "";
			while (i < len && source[i] !== "`") {
				if (source[i] === "\\" && i + 1 < len) {
					content += source[i] + source[i + 1];
					i += 2;
					continue;
				}
				if (source[i] === "\n") line++;
				content += source[i];
				i++;
			}
			i++; // closing backtick
			literals.push({ line: startLine, content });
			continue;
		}

		i++;
	}

	return literals;
}

function findDoctrineLiterals(source: string): { line: number; excerpt: string }[] {
	return extractStringLiterals(source)
		.filter(
			(lit) =>
				lit.content.length > DOCTRINE_THRESHOLD && DOCTRINE_TRIGGER.test(lit.content),
		)
		.map((lit) => ({
			line: lit.line,
			// Truncate to ~80 chars so a failure does not paste a full doctrine blob
			// back into the AI assistant's context and poison the very invariant
			// this test is trying to enforce.
			excerpt:
				lit.content.length > 80 ? lit.content.slice(0, 80) + "…" : lit.content,
		}));
}

describe("init subtree doctrine literal guard", () => {
	for (const filePath of GUARDED_FILES) {
		const relative = filePath.slice(MODULE_DIR.length + 1).replace(/\\/g, "/");

		it(`${relative} contains no AIDE doctrine as string literals`, async () => {
			const source = await readFile(filePath, "utf-8");
			const offenders = findDoctrineLiterals(source);

			if (offenders.length > 0) {
				const report = offenders
					.map((o) => `  ${relative}:${o.line}  ${JSON.stringify(o.excerpt)}`)
					.join("\n");
				throw new Error(
					`Found ${offenders.length} doctrine literal(s) in ${relative} ` +
						`(string literals > ${DOCTRINE_THRESHOLD} chars matching /aide|pipeline/):\n${report}`,
				);
			}

			expect(offenders).toEqual([]);
		});
	}

	// Sanity check: the matcher itself works. Build a synthetic doctrine-like
	// literal at runtime (so no real doctrine is pasted into this source) and
	// confirm it is flagged. Generating the fixture from "AIDE " + "x".repeat(...)
	// keeps the fixture obviously synthetic and under the matcher's own filter.
	it("matcher flags a synthetic long doctrine-like literal", () => {
		const fake = `const x = "AIDE ${"x".repeat(300)}";`;
		const hits = findDoctrineLiterals(fake);
		expect(hits).toHaveLength(1);
		expect(hits[0].line).toBe(1);
	});

	it("matcher ignores long literals that do not trigger the keyword check", () => {
		const fake = `const x = "${"lorem ipsum ".repeat(40)}";`;
		expect(findDoctrineLiterals(fake)).toEqual([]);
	});

	it("matcher ignores doctrine-like text inside comments", () => {
		const fake = `
			/* AIDE pipeline ${"x".repeat(300)} */
			// AIDE pipeline ${"x".repeat(300)}
			const x = "short";
		`;
		expect(findDoctrineLiterals(fake)).toEqual([]);
	});
});
