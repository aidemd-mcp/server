import { describe, it, expect } from "vitest";
import { readdir, readFile } from "node:fs/promises";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import brainContract from "../brainContract/index.js";
import toMarkerPair from "../brainContract/toMarkerPair/index.js";

/**
 * Regression guard for the brain config's single-source contract.
 *
 * The parseBrainAide spec forbids the required-section list being restated
 * anywhere besides its single published source (`src/service/brainContract`).
 * This test walks every non-test `.ts` file under `src/` and fails when any
 * string or template literal contains a contract marker's open or close token
 * (`aide-<marker>-start` / `aide-<marker>-end`). The marker list is read from
 * the contract itself, so the guard grows with it.
 *
 * Excluded by design:
 *   - `src/service/brainContract/**`: the single source itself.
 *   - `src/service/install/provisionBrain/obsidianBrainAideTemplate/**`: the
 *     bundled template is content, not a list.
 *   - `*.test.ts` and `*.d.ts` files.
 *
 * The scanner strips line and block comments before tokenizing, so JSDoc that
 * quotes marker text for reader context does not trip the guard. It does not
 * follow `${...}` interpolation inside templates or fold `"a" + "b"` across
 * literals; a marker token split across concatenated literals would pass.
 *
 * The same invariant holds for prose. A second scan reads every `.md` and
 * `.aide` file under `.claude/` (agents, commands, skills, the `.claude/.aide`
 * spec) and `.aide/docs/`, and fails on any full marker token built from the
 * contract via `toMarkerPair`, with or without its HTML-comment wrapper. Prose
 * is scanned verbatim (no comment stripping) and has no exemptions.
 * Placeholders such as `aide-<marker>-start` are not real tokens and pass.
 * Ephemeral pipeline files (`session.aide`, `plan.aide`, `brief.aide`,
 * `todo.aide`) are out of scope.
 */

const SRC_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

const REPO_ROOT = join(SRC_DIR, "..");

const PROSE_ROOTS = [join(REPO_ROOT, ".claude"), join(REPO_ROOT, ".aide", "docs")];

const EPHEMERAL_PROSE_FILES = ["session.aide", "plan.aide", "brief.aide", "todo.aide"];

const EXCLUDED_DIRS = [
	["service", "brainContract"],
	["service", "install", "provisionBrain", "obsidianBrainAideTemplate"],
].map((segments) => join(SRC_DIR, ...segments));

const MARKER_TOKENS = brainContract.flatMap(({ marker }) => [
	`aide-${marker}-start`,
	`aide-${marker}-end`,
]);

/** Full marker tokens (comment wrapper stripped) for every contract entry, built via toMarkerPair. */
const PROSE_TOKENS = brainContract.flatMap(({ marker }) => {
	const { open, close } = toMarkerPair(marker);
	return [open, close].map((wrapped) => wrapped.replace(/^<!--\s*/, "").replace(/\s*-->$/, ""));
});

interface ExtractedLiteral {
	/** 1-based line number where the literal opens. */
	line: number;
	/** The string content between (but not including) the quote delimiters. */
	content: string;
}

/**
 * Walk the source character by character, skipping comments, and collect every
 * string literal (single-quoted, double-quoted, template).
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

		if (ch === "/" && next === "/") {
			while (i < len && source[i] !== "\n") i++;
			continue;
		}

		if (ch === "/" && next === "*") {
			i += 2;
			while (i < len && !(source[i] === "*" && source[i + 1] === "/")) {
				if (source[i] === "\n") line++;
				i++;
			}
			i += 2;
			continue;
		}

		if (ch === "'" || ch === '"' || ch === "`") {
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
				if (source[i] === "\n") {
					// An unterminated single- or double-quoted literal ends at the line
					// break; only templates may span lines.
					if (quote !== "`") break;
					line++;
				}
				content += source[i];
				i++;
			}
			i++;
			literals.push({ line: startLine, content });
			continue;
		}

		i++;
	}

	return literals;
}

/** Marker tokens restated by a string or template literal in the source, with the line each sits on. */
function findMarkerLiterals(source: string): { line: number; token: string }[] {
	return extractStringLiterals(source).flatMap((literal) =>
		MARKER_TOKENS.filter((token) => literal.content.includes(token)).map((token) => ({
			line: literal.line,
			token,
		})),
	);
}

/** Real marker tokens in prose text, with the 1-based line each sits on. Matches with or without the HTML-comment wrapper. */
function findMarkerTokensInProse(text: string): { line: number; token: string }[] {
	return text.split(/\r?\n/).flatMap((content, index) =>
		PROSE_TOKENS.filter((token) => content.includes(token)).map((token) => ({
			line: index + 1,
			token,
		})),
	);
}

async function collectProseFiles(dir: string): Promise<string[]> {
	const entries = await readdir(dir, { withFileTypes: true });
	const nested = await Promise.all(
		entries.map(async (entry) => {
			const full = join(dir, entry.name);
			if (entry.isDirectory()) return collectProseFiles(full);
			const isProse = entry.name.endsWith(".md") || entry.name.endsWith(".aide");
			return isProse && !EPHEMERAL_PROSE_FILES.includes(entry.name) ? [full] : [];
		}),
	);
	return nested.flat();
}

async function collectSourceFiles(dir: string): Promise<string[]> {
	if (EXCLUDED_DIRS.includes(dir)) return [];
	const entries = await readdir(dir, { withFileTypes: true });
	const nested = await Promise.all(
		entries.map(async (entry) => {
			const full = join(dir, entry.name);
			if (entry.isDirectory()) return collectSourceFiles(full);
			const isSource =
				entry.name.endsWith(".ts") &&
				!entry.name.endsWith(".test.ts") &&
				!entry.name.endsWith(".d.ts");
			return isSource ? [full] : [];
		}),
	);
	return nested.flat();
}

describe("brain contract single-source guard", () => {
	it("no non-test source file outside the contract and the bundled template restates a marker token", async () => {
		const files = await collectSourceFiles(SRC_DIR);
		expect(files.length).toBeGreaterThan(0);

		const offenders: string[] = [];
		for (const file of files) {
			const hits = findMarkerLiterals(await readFile(file, "utf-8"));
			const rel = relative(SRC_DIR, file).split(sep).join("/");
			for (const hit of hits) offenders.push(`  src/${rel}:${hit.line}  ${hit.token}`);
		}

		if (offenders.length > 0) {
			throw new Error(
				`Found ${offenders.length} restatement(s) of a brain-contract marker token outside its single source:\n${offenders.join("\n")}`,
			);
		}
		expect(offenders).toEqual([]);
	});

	it("walks the source tree rather than an empty set, and skips the excluded subtrees", async () => {
		const files = await collectSourceFiles(SRC_DIR);
		const rels = files.map((f) => relative(SRC_DIR, f).split(sep).join("/"));
		expect(rels).toContain("service/parseBrainAide/index.ts");
		expect(rels.some((r) => r.startsWith("service/brainContract/"))).toBe(false);
		expect(rels.some((r) => r.includes("obsidianBrainAideTemplate/"))).toBe(false);
		expect(rels.some((r) => r.endsWith(".test.ts"))).toBe(false);
	});

	it("the matcher flags a marker token in each literal kind", () => {
		const [first] = MARKER_TOKENS;
		const hits = findMarkerLiterals(
			[`const a = "${first}";`, `const b = '${first}';`, `const c = \`x ${first} y\`;`].join("\n"),
		);
		expect(hits.map((h) => h.line)).toEqual([1, 2, 3]);
	});

	it("the matcher covers both the open and close token of every contract marker", () => {
		expect(MARKER_TOKENS).toHaveLength(brainContract.length * 2);
		for (const token of MARKER_TOKENS) {
			expect(findMarkerLiterals(`const x = "<!-- ${token} -->";`)).toHaveLength(1);
		}
	});

	it("the matcher ignores marker tokens inside comments", () => {
		const [first] = MARKER_TOKENS;
		const fake = `
			/* ${first} */
			// ${first}
			const x = "short";
		`;
		expect(findMarkerLiterals(fake)).toEqual([]);
	});

	it("no .claude/ or .aide/docs/ prose file restates a marker token", async () => {
		const files = (await Promise.all(PROSE_ROOTS.map(collectProseFiles))).flat();
		expect(files.length).toBeGreaterThan(0);

		const offenders: string[] = [];
		for (const file of files) {
			const rel = relative(REPO_ROOT, file).split(sep).join("/");
			for (const hit of findMarkerTokensInProse(await readFile(file, "utf-8"))) {
				offenders.push(`  ${rel}:${hit.line}  ${hit.token}`);
			}
		}

		if (offenders.length > 0) {
			throw new Error(
				`Found ${offenders.length} restatement(s) of a brain-contract marker token in prose outside its single source:\n${offenders.join("\n")}`,
			);
		}
		expect(offenders).toEqual([]);
	});

	it("the prose walk covers agents, commands, skills, the .claude spec, and the methodology docs, and skips ephemerals", async () => {
		const files = (await Promise.all(PROSE_ROOTS.map(collectProseFiles))).flat();
		const rels = files.map((f) => relative(REPO_ROOT, f).split(sep).join("/"));
		expect(rels).toContain(".claude/.aide");
		expect(rels).toContain(".claude/commands/aide/brain.md");
		expect(rels).toContain(".claude/skills/aide/SKILL.md");
		expect(rels.some((r) => r.startsWith(".claude/agents/"))).toBe(true);
		expect(rels).toContain(".aide/docs/brain-aide.md");
		expect(rels.some((r) => EPHEMERAL_PROSE_FILES.includes(r.split("/").pop() ?? ""))).toBe(false);
	});

	it("the prose matcher flags a real token with or without the comment wrapper, and ignores placeholders", () => {
		expect(PROSE_TOKENS).toHaveLength(brainContract.length * 2);
		for (const token of PROSE_TOKENS) {
			expect(findMarkerTokensInProse(`intro\n<!-- ${token} -->`)).toEqual([{ line: 2, token }]);
			expect(findMarkerTokensInProse(`wrap \`${token}\` bare`)).toEqual([{ line: 1, token }]);
		}
		expect(
			findMarkerTokensInProse("use aide-<marker>-start and aide-<marker>-end, or <!-- aide-<name>-start -->"),
		).toEqual([]);
	});
});
