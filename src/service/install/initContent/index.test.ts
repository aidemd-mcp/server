import { existsSync, readFileSync, renameSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";
import brainContract from "../../brainContract/index.js";
import {
	getCanonicalPath,
	getMethodologyMarker,
	listAgents,
	listMethodologyDocs,
	listSkills,
	readCanonicalDoc,
} from "./index.js";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");
const METHODOLOGY_ROOT = join(REPO_ROOT, ".aide", "docs");
const COMMANDS_ROOT = join(REPO_ROOT, ".claude", "commands");

// Mirrors brainContract brief commitment #4 (backend-agnostic vocabulary); the ban still governs this skill under the delegation's narrowed scope.
const BANNED_PATTERNS: RegExp[] = [
	/\bvault\b/i,
	/\bobsidian\b/i,
	/\bnotes?\b/i,
	/wikilink/i,
	/\bhubs?\b/i,
	/\[\[/,
	/mcp__/i,
	/kanban-plugin/i,
];

describe("readCanonicalDoc", () => {
	it("returns disk bytes verbatim for aide-spec", () => {
		const onDisk = readFileSync(join(METHODOLOGY_ROOT, "aide-spec.md"), "utf-8");
		expect(readCanonicalDoc("aide-spec")).toBe(onDisk);
	});

	it("returns disk bytes verbatim for a command template", () => {
		const onDisk = readFileSync(join(COMMANDS_ROOT, "aide", "research.md"), "utf-8");
		expect(readCanonicalDoc("commands/aide/research")).toBe(onDisk);
	});

	it("returns disk bytes verbatim for skills/brain", () => {
		const onDisk = readFileSync(join(REPO_ROOT, ".claude", "skills", "brain", "SKILL.md"), "utf-8");
		expect(readCanonicalDoc("skills/brain")).toBe(onDisk);
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
		const original = join(METHODOLOGY_ROOT, "automated-qa.md");
		const sidelined = join(METHODOLOGY_ROOT, "automated-qa.md.missing-for-test");
		renameSync(original, sidelined);
		try {
			expect(() => readCanonicalDoc("automated-qa")).toThrow(/automated-qa/);
			expect(() => readCanonicalDoc("automated-qa")).toThrow(/not readable/);
		} finally {
			renameSync(sidelined, original);
		}
	});
});

describe("listMethodologyDocs — brain-aide registration (Step 4a/4c)", () => {
	it("includes an entry with canonical 'brain-aide' and hostFilename 'brain-aide.md'", () => {
		const docs = listMethodologyDocs();
		const entry = docs.find((d) => d.canonical === "brain-aide");
		expect(entry).toBeDefined();
		expect(entry!.hostFilename).toBe("brain-aide.md");
	});

	it("preserves the expected methodology-doc count after brain-aide was added", () => {
		// This count must be updated whenever a new methodology doc is added to
		// METHODOLOGY_DOCS. Failing here means the registry changed without a
		// corresponding update to this guard — making the omission visible at CI
		// time rather than shipping a silently incomplete methodology install.
		expect(listMethodologyDocs()).toHaveLength(13);
	});

	it("lists brain-aide after todo-aide (doc index reading-order invariant)", () => {
		const docs = listMethodologyDocs();
		const todoIndex = docs.findIndex((d) => d.canonical === "todo-aide");
		const brainIndex = docs.findIndex((d) => d.canonical === "brain-aide");
		expect(todoIndex).toBeGreaterThanOrEqual(0);
		expect(brainIndex).toBeGreaterThan(todoIndex);
	});
});

describe("readCanonicalDoc — brain-aide content (Step 4b)", () => {
	it("returns a non-empty string whose first line is '# brain.aide Spec'", () => {
		const content = readCanonicalDoc("brain-aide");
		expect(content.length).toBeGreaterThan(0);
		const firstLine = content.split("\n")[0];
		expect(firstLine).toBe("# brain.aide Spec");
	});
});

describe("kanban pointer skill", () => {
	const OPERATIONS = ["create", "work", "manage", "move", "complete", "stash", "review"];

	function readBody(content: string): string[] {
		const closing = content.indexOf("\n---", 4);
		return content
			.slice(closing + "\n---".length)
			.split("\n")
			.filter((line) => line.trim() !== "");
	}

	it("is readable through readCanonicalDoc and matches the file on disk", () => {
		const onDisk = readFileSync(join(REPO_ROOT, ".claude", "skills", "kanban", "SKILL.md"), "utf-8");
		expect(readCanonicalDoc("skills/kanban")).toBe(onDisk);
	});

	it("is registered in listSkills with hostPath kanban/SKILL.md", () => {
		const entry = listSkills().find((s) => s.canonical === "skills/kanban");
		expect(entry).toBeDefined();
		expect(entry!.hostPath).toBe("kanban/SKILL.md");
	});

	it("declares frontmatter name 'kanban'", () => {
		expect(readCanonicalDoc("skills/kanban")).toMatch(/^---\r?\nname: kanban\r?\n/);
	});

	it("points at the kanban index kanban/kanban.md", () => {
		const kanbanIndex = brainContract.find((entry) => entry.marker === "kanban-index");
		if (kanbanIndex?.role !== "seed") throw new Error("brainContract has no seeded kanban-index entry");
		const skill = readCanonicalDoc("skills/kanban");
		expect(skill).toContain(kanbanIndex.seedPath);
		expect(skill).not.toContain("kanban/work-kanban.md");
	});

	it("routes to one operation guide without restating guide paths", () => {
		const skill = readCanonicalDoc("skills/kanban");
		expect(skill).not.toContain("kanban/guide/");
		expect(skill).toContain("only the guide");
	});

	it.each(OPERATIONS)("names the %s operation", (operation) => {
		expect(readCanonicalDoc("skills/kanban")).toContain(operation);
	});

	it.each(["aide_brain", "aide_", ".aide", "brain.aide"])(
		"does not contain %s, so it works in non-AIDE projects",
		(token) => {
			expect(readCanonicalDoc("skills/kanban")).not.toContain(token);
		},
	);

	it.each(BANNED_PATTERNS.map((pattern) => [pattern.source, pattern] as const))(
		"matches no banned backend pattern %s",
		(_source, pattern) => {
			expect(readCanonicalDoc("skills/kanban")).not.toMatch(pattern);
		},
	);

	it("carries no board column list", () => {
		expect(readCanonicalDoc("skills/kanban")).not.toContain("## Backlog");
	});

	it("keeps its body at 15 non-blank lines or fewer — it points, it does not carry procedure", () => {
		expect(readBody(readCanonicalDoc("skills/kanban")).length).toBeLessThanOrEqual(15);
	});
});

describe("kanban board agent", () => {
	it("is readable through readCanonicalDoc and matches the file on disk", () => {
		const onDisk = readFileSync(join(REPO_ROOT, ".claude", "agents", "kanban", "kanban-maintainer.md"), "utf-8");
		expect(readCanonicalDoc("agents/kanban/kanban-maintainer")).toBe(onDisk);
	});

	it("is registered last in listAgents with hostFilename kanban/kanban-maintainer.md", () => {
		const agents = listAgents();
		const entry = agents.find((a) => a.canonical === "agents/kanban/kanban-maintainer");
		expect(entry).toBeDefined();
		expect(entry!.hostFilename).toBe("kanban/kanban-maintainer.md");
		expect(agents[agents.length - 1]).toBe(entry);
	});

	it("declares frontmatter name 'kanban-maintainer'", () => {
		expect(readCanonicalDoc("agents/kanban/kanban-maintainer")).toMatch(/^---\r?\nname: kanban-maintainer\r?\n/);
	});

	it.each(["aide_brain", "aide_", ".aide", "brain.aide"])(
		"does not contain %s, so it works in non-AIDE projects",
		(token) => {
			expect(readCanonicalDoc("agents/kanban/kanban-maintainer")).not.toContain(token);
		},
	);

	it.each(BANNED_PATTERNS.map((pattern) => [pattern.source, pattern] as const))(
		"matches no banned backend pattern %s",
		(_source, pattern) => {
			expect(readCanonicalDoc("agents/kanban/kanban-maintainer")).not.toMatch(pattern);
		},
	);
});

describe("aide-upgrader agent", () => {
	it("is readable through readCanonicalDoc and matches the file on disk", () => {
		const onDisk = readFileSync(join(REPO_ROOT, ".claude", "agents", "aide", "aide-upgrader.md"), "utf-8");
		expect(readCanonicalDoc("agents/aide/aide-upgrader")).toBe(onDisk);
	});

	it("is registered in listAgents with hostFilename aide/aide-upgrader.md, between the maintainer and the board agent", () => {
		const agents = listAgents();
		const index = agents.findIndex((a) => a.canonical === "agents/aide/aide-upgrader");
		expect(index).toBeGreaterThanOrEqual(0);
		expect(agents[index].hostFilename).toBe("aide/aide-upgrader.md");
		expect(agents[index - 1]?.canonical).toBe("agents/aide/aide-maintainer");
		expect(agents[index + 1]?.canonical).toBe("agents/kanban/kanban-maintainer");
	});

	it("declares frontmatter name 'aide-upgrader'", () => {
		expect(readCanonicalDoc("agents/aide/aide-upgrader")).toMatch(/^---\r?\nname: aide-upgrader\r?\n/);
	});
});

type ChangelogFault = { line: number; reason: string };

/** Splits text on LF or CRLF into numbered lines, marking fence lines and the lines between them as fenced. */
function numberLines(text: string): { line: number; text: string; fenced: boolean }[] {
	let inFence = false;
	return text.split(/\r?\n/).map((lineText, index) => {
		const isFence = lineText.startsWith("```");
		const fenced = inFence || isFence;
		if (isFence) inFence = !inFence;
		return { line: index + 1, text: lineText, fenced };
	});
}

/** Faults for every level-2 heading outside code fences that is neither `## [Unreleased]` nor `## [x.y.z] - YYYY-MM-DD`. */
function findReleaseHeadingFaults(text: string): ChangelogFault[] {
	const faults: ChangelogFault[] = [];
	for (const { line, text: lineText, fenced } of numberLines(text)) {
		if (fenced || !lineText.startsWith("## ")) continue;
		const valid = /^## \[Unreleased\]$/.test(lineText) || /^## \[\d+\.\d+\.\d+\] - \d{4}-\d{2}-\d{2}$/.test(lineText);
		if (!valid) faults.push({ line, reason: `release heading "${lineText}" is neither "## [Unreleased]" nor "## [x.y.z] - YYYY-MM-DD"` });
	}
	return faults;
}

/** Counts `- [migration] <text>` bullets at column 0 outside code fences. */
function countMigrations(text: string): number {
	return numberLines(text).filter(({ text: lineText, fenced }) => !fenced && /^- \[migration\] \S/.test(lineText)).length;
}

/** Faults for malformed `[migration]` bullets: wrong bullet shape, stray block lines, sub-bullets not Detect/Migrate/Confirm in order, blank text, or a Confirm that is neither "once, as a batch" nor "per file ...". */
function findMigrationFaults(text: string): ChangelogFault[] {
	const faults: ChangelogFault[] = [];
	const lines = numberLines(text);
	for (let i = 0; i < lines.length; i++) {
		const { line, text: lineText, fenced } = lines[i];
		if (fenced) continue;
		if (!/^- \[migration\] \S/.test(lineText)) {
			if (/^\s*[-*] \[migration\]/.test(lineText)) {
				faults.push({ line, reason: `migration bullet must be "- [migration] <text>" at column 0, found "${lineText}"` });
			}
			continue;
		}

		const subBullets: { line: number; label: string; text: string }[] = [];
		for (let j = i + 1; j < lines.length; j++) {
			const next = lines[j];
			if (next.fenced || next.text.trim() === "" || !/^\s/.test(next.text)) break;
			if (/^ {2}- /.test(next.text)) {
				const rest = next.text.slice(4);
				const colon = rest.indexOf(":");
				subBullets.push({
					line: next.line,
					label: colon < 0 ? rest : rest.slice(0, colon),
					text: colon < 0 ? "" : rest.slice(colon + 1).trim(),
				});
			} else if (/^ {4,}\S/.test(next.text) && subBullets.length > 0) {
				continue;
			} else {
				faults.push({ line: next.line, reason: `unexpected line in migration block: "${next.text}"` });
			}
		}

		const expected = ["Detect", "Migrate", "Confirm"];
		const found = subBullets.map((s) => s.label);
		if (found.length !== expected.length || found.some((label, index) => label !== expected[index])) {
			faults.push({
				line,
				reason: `migration bullet needs sub-bullets ${expected.join(", ")} in order, found ${found.length > 0 ? found.join(", ") : "none"}`,
			});
			continue;
		}
		for (const sub of subBullets) {
			if (sub.text === "") faults.push({ line: sub.line, reason: `${sub.label} sub-bullet has no text` });
		}
		const confirm = subBullets[2];
		if (confirm.text !== "" && !/^once, as a batch\.?$/.test(confirm.text) && !/^per file\b/.test(confirm.text)) {
			faults.push({ line: confirm.line, reason: `Confirm must be "once, as a batch" or start "per file", found "${confirm.text}"` });
		}
	}
	return faults;
}

/** One fault per line as `CHANGELOG.md:<line>: <reason>`, empty when there are none. */
function formatFaults(faults: ChangelogFault[]): string {
	return faults.map(({ line, reason }) => `CHANGELOG.md:${line}: ${reason}`).join("\n");
}

describe("changelog", () => {
	it("is readable through readCanonicalDoc and matches CHANGELOG.md at the repo root", () => {
		const onDisk = readFileSync(join(REPO_ROOT, "CHANGELOG.md"), "utf-8");
		expect(readCanonicalDoc("changelog")).toBe(onDisk);
	});

	it("resolves to the repo-root path and is the last methodology doc", () => {
		expect(getCanonicalPath("changelog")).toBe("CHANGELOG.md");
		const docs = listMethodologyDocs();
		expect(docs[docs.length - 1]).toEqual({ canonical: "changelog", hostFilename: "changelog.md" });
	});

	it("has one source: no copy of the changelog exists under .aide/docs", () => {
		// The root file is the only source; a copy under .aide/docs/ would fork it and land in
		// src/retiredVocabulary.test.ts's scanned set, where the migration entries' old forms would be flagged.
		expect(existsSync(join(REPO_ROOT, ".aide", "docs", "changelog.md"))).toBe(false);
	});

	it("headings: every level-2 heading is [Unreleased] or [x.y.z] - YYYY-MM-DD", () => {
		expect(formatFaults(findReleaseHeadingFaults(readCanonicalDoc("changelog")))).toBe("");
	});

	it("migrations: every [migration] bullet carries Detect, Migrate and Confirm in the documented form", () => {
		const text = readCanonicalDoc("changelog");
		expect(formatFaults(findMigrationFaults(text))).toBe("");
		expect(countMigrations(text)).toBeGreaterThan(0);
	});
});

describe("changelog rules — self-test", () => {
	const entry = (confirm: string, extra: string[] = []) => [
		"- [migration] Something changed.",
		"  - Detect: a file with the old form.",
		"  - Migrate: set the new form.",
		`  - Confirm: ${confirm}`,
		...extra,
	];

	it("accepts a once-as-a-batch entry and a per-file entry", () => {
		expect(findMigrationFaults(entry("once, as a batch.").join("\n"))).toEqual([]);
		expect(findMigrationFaults(entry("per file, offering the suggestion with its evidence.").join("\n"))).toEqual([]);
	});

	it("accepts a sub-bullet that wraps onto a four-space continuation line", () => {
		const lines = entry("once, as a batch.");
		lines.splice(2, 0, "    and wraps onto a second line.");
		expect(findMigrationFaults(lines.join("\n"))).toEqual([]);
	});

	it("faults a missing Confirm on the bullet line", () => {
		const lines = entry("once, as a batch.").slice(0, 3);
		expect(findMigrationFaults(lines.join("\n")).map((f) => f.line)).toEqual([1]);
	});

	it("faults an extra fourth sub-bullet on the bullet line", () => {
		const lines = entry("once, as a batch.", ["  - Note: more."]);
		expect(findMigrationFaults(lines.join("\n")).map((f) => f.line)).toEqual([1]);
	});

	it("faults Migrate before Detect on the bullet line", () => {
		const lines = entry("once, as a batch.");
		[lines[1], lines[2]] = [lines[2], lines[1]];
		expect(findMigrationFaults(lines.join("\n")).map((f) => f.line)).toEqual([1]);
	});

	it("faults an unknown Confirm form on the Confirm line", () => {
		expect(findMigrationFaults(entry("whenever").join("\n")).map((f) => f.line)).toEqual([4]);
	});

	it("faults an indented migration bullet on its own line", () => {
		const text = ["### Changed", "  - [migration] x"].join("\n");
		expect(findMigrationFaults(text).map((f) => f.line)).toEqual([2]);
	});

	it("counts migration bullets", () => {
		expect(countMigrations([...entry("once, as a batch."), "", ...entry("per file, x")].join("\n"))).toBe(2);
	});

	it("accepts [Unreleased] and a dated release heading", () => {
		expect(findReleaseHeadingFaults("## [Unreleased]\n\n## [0.11.1] - 2026-10-10")).toEqual([]);
	});

	it.each(["## 0.11.1 - 2026-10-10", "## [0.11.1]", "## [0.11] - 2026-10-10"])("faults the heading %s", (heading) => {
		expect(findReleaseHeadingFaults(`# Changelog\n\n${heading}`).map((f) => f.line)).toEqual([3]);
	});

	it("ignores a level-2 heading inside a fenced block", () => {
		expect(findReleaseHeadingFaults("```\n## nope\n```")).toEqual([]);
	});

	it("gives the same faults for CRLF input as for LF input", () => {
		const lf = [
			"## nope",
			...entry("whenever"),
			"- [migration] Second.",
			"  - Detect: a.",
		].join("\n");
		const crlf = lf.replace(/\n/g, "\r\n");
		expect(findReleaseHeadingFaults(crlf)).toEqual(findReleaseHeadingFaults(lf));
		expect(findMigrationFaults(crlf)).toEqual(findMigrationFaults(lf));
		expect(findMigrationFaults(lf).length).toBeGreaterThan(0);
	});
});

// Narrower than BANNED_PATTERNS: this skill writes configs for any backend, so it
// legitimately names example backends and talks about pages and notes (`\bnotes?\b`,
// `\bhubs?\b` would fail on honest prose). What must never appear is the bundled
// template's own backend wiring: its tool namespace, link syntax, plugin name, and
// the backend's name and storage term.
const AUTHOR_BANNED_PATTERNS: RegExp[] = [
	/mcp__/i,
	/\[\[/,
	/wikilink/i,
	/kanban-plugin/i,
	/\bvault\b/i,
	/\bobsidian\b/i,
];

describe("aide-brain-author skill", () => {
	it("is readable through readCanonicalDoc and matches the file on disk", () => {
		const onDisk = readFileSync(join(REPO_ROOT, ".claude", "skills", "aide-brain-author", "SKILL.md"), "utf-8");
		expect(readCanonicalDoc("skills/aide-brain-author")).toBe(onDisk);
	});

	it("is registered last in listSkills with hostPath aide-brain-author/SKILL.md", () => {
		const skills = listSkills();
		const entry = skills.find((s) => s.canonical === "skills/aide-brain-author");
		expect(entry).toBeDefined();
		expect(entry!.hostPath).toBe("aide-brain-author/SKILL.md");
		expect(skills[skills.length - 1]).toBe(entry);
	});

	it("declares frontmatter name 'aide-brain-author'", () => {
		expect(readCanonicalDoc("skills/aide-brain-author")).toMatch(/^---\r?\nname: aide-brain-author\r?\n/);
	});

	it.each(["aide_brain", "source", "path", '"template"', '"contract"', '"draft"', '"launcher"'])(
		"names the tool mode %s it drives",
		(token) => {
			expect(readCanonicalDoc("skills/aide-brain-author")).toContain(token);
		},
	);

	it.each(AUTHOR_BANNED_PATTERNS.map((pattern) => [pattern.source, pattern] as const))(
		"matches no backend-wiring pattern %s",
		(_source, pattern) => {
			expect(readCanonicalDoc("skills/aide-brain-author")).not.toMatch(pattern);
		},
	);
});

describe("published package file set", () => {
	const files: string[] = JSON.parse(readFileSync(join(REPO_ROOT, "package.json"), "utf-8")).files;

	function isShipped(path: string): boolean {
		return files.some((entry) => path === entry || path.startsWith(`${entry}/`));
	}

	it("covers every listAgents path with a package.json files entry", () => {
		for (const agent of listAgents()) {
			const path = getCanonicalPath(agent.canonical);
			expect(isShipped(path), `${path} is not covered by package.json "files"`).toBe(true);
		}
	});

	it("covers every listSkills path with a package.json files entry", () => {
		for (const skill of listSkills()) {
			const path = getCanonicalPath(skill.canonical);
			expect(isShipped(path), `${path} is not covered by package.json "files"`).toBe(true);
		}
	});

	it("covers every listMethodologyDocs path with a package.json files entry", () => {
		for (const doc of listMethodologyDocs()) {
			const path = getCanonicalPath(doc.canonical);
			expect(isShipped(path), `${path} is not covered by package.json "files"`).toBe(true);
		}
	});
});

describe("getMethodologyMarker", () => {
	it("is byte-stable — changing it would break idempotency on every existing install", () => {
		expect(getMethodologyMarker()).toBe("<!-- aide-methodology -->");
	});
});

