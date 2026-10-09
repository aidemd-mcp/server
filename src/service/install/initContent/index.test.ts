import { readFileSync, renameSync } from "node:fs";
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
		expect(listMethodologyDocs()).toHaveLength(12);
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
});

describe("getMethodologyMarker", () => {
	it("is byte-stable — changing it would break idempotency on every existing install", () => {
		expect(getMethodologyMarker()).toBe("<!-- aide-methodology -->");
	});
});

