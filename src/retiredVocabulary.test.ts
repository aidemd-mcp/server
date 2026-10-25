import { describe, it, expect } from "vitest";
import { readdir, readFile } from "node:fs/promises";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Guard against retired AIDE-file vocabulary in shipped prose.
 *
 * Intent specs record alignment in an `alignment` field, and plan, todo and
 * brief files carry one status lifecycle; both change only through
 * `aide_frontmatter`. This test walks the prose the package ships and fails on
 * any line that still teaches the older wording: alignment stored in `status`,
 * the retired `allowEmptyPlan` option, the retired `in-flight` status value, or
 * instructions to hand-edit alignment or status. Each failure line reads
 * `<repo-relative path>:<line>: <rule> — <line text>`, so the list is the
 * worklist for the prose sweep.
 *
 * Scanned: every `.md` and `.aide` file under `.claude/agents/`,
 * `.claude/commands/`, `.claude/skills/` and `.aide/docs/`, plus `README.md`.
 * Prose is scanned verbatim, line by line, with no comment stripping.
 *
 * Excluded by design:
 *   - Ephemeral pipeline files (`session.aide`, `plan.aide`, `brief.aide`,
 *     `todo.aide`): per-feature working files, not shipped prose.
 *   - The brain and kanban folders: their `status` words belong to the board
 *     and the brain, unrelated to AIDE file frontmatter.
 *
 * Expected to fail until the main agent's prose sweep lands: today's prose
 * still uses the older wording. The self-test block proves each rule on
 * sample lines and passes regardless of the repo's prose.
 */

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const SCANNED_DIRS = [
	[".claude", "agents"],
	[".claude", "commands"],
	[".claude", "skills"],
	[".aide", "docs"],
].map((segments) => join(REPO_ROOT, ...segments));

const SCANNED_FILES = [join(REPO_ROOT, "README.md")];

/** Ephemeral pipeline files are per-feature working files, not shipped prose. */
const EPHEMERAL_PROSE_FILES = ["session.aide", "plan.aide", "brief.aide", "todo.aide"];

/** Kanban and brain vocabulary use `status` for board and brain notes, unrelated to AIDE frontmatter. */
const EXCLUDED_DIRS = [
	[".claude", "agents", "kanban"],
	[".claude", "skills", "kanban"],
	[".claude", "skills", "brain"],
	[".claude", "skills", "aide-brain-author"],
].map((segments) => join(REPO_ROOT, ...segments));

/** The older name for a spec's alignment: `status: aligned` or `status: misaligned`. */
const LEGACY_SPEC_FIELD = /\bstatus:\s*(aligned|misaligned)\b/;

/** An instruction to put alignment in a spec's status. */
const SPEC_STATUS_INSTRUCTION =
	/\b(set|sets|setting|write|writes|writing|mark|marks|update|updates)\b[^.\n]{0,40}\bstatus\b[^.\n]{0,30}\b(aligned|misaligned)\b/i;

/** The retired `allowEmptyPlan` cleanup option. */
const ALLOW_EMPTY_PLAN = /allowEmptyPlan/;

/** The retired status value; generic prose writes "in flight" without the hyphen. */
const IN_FLIGHT = /\bin-flight\b/;

/** Words that tell a reader to change a value by hand. */
const HAND_EDIT_WORDS = /\b(by hand|hand[- ]edit\w*|manually)\b/i;

/** The two fields that now change only through the tool. */
const GOVERNED_FIELD_WORDS = /\b(alignment|status)\b/;

/** A line that points callers to the tool is allowed to mention hand edits. */
const TOOL_POINTER = "aide_frontmatter";

interface Rule {
	name: string;
	/** True when the line breaks the rule. */
	violates: (line: string) => boolean;
}

const RULES: Rule[] = [
	{ name: "legacy-spec-field", violates: (line) => LEGACY_SPEC_FIELD.test(line) },
	{ name: "spec-status-instruction", violates: (line) => SPEC_STATUS_INSTRUCTION.test(line) },
	{ name: "allow-empty-plan", violates: (line) => ALLOW_EMPTY_PLAN.test(line) },
	{ name: "in-flight", violates: (line) => IN_FLIGHT.test(line) },
	{
		name: "hand-edit",
		violates: (line) =>
			HAND_EDIT_WORDS.test(line) && GOVERNED_FIELD_WORDS.test(line) && !line.includes(TOOL_POINTER),
	},
];

interface Hit {
	/** 1-based line number. */
	line: number;
	rule: string;
	text: string;
}

/** Rules broken by a single line of prose. */
function brokenRules(line: string): string[] {
	return RULES.filter((rule) => rule.violates(line)).map((rule) => rule.name);
}

/** Every rule hit in a prose file's text, one entry per line and rule. */
function findRetiredVocabulary(text: string): Hit[] {
	return text.split(/\r?\n/).flatMap((content, index) =>
		brokenRules(content).map((rule) => ({ line: index + 1, rule, text: content.trim() })),
	);
}

async function collectProseFiles(dir: string): Promise<string[]> {
	if (EXCLUDED_DIRS.includes(dir)) return [];
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

async function collectScannedFiles(): Promise<string[]> {
	const walked = await Promise.all(SCANNED_DIRS.map(collectProseFiles));
	return [...walked.flat(), ...SCANNED_FILES];
}

describe("retired AIDE-file vocabulary guard", () => {
	it("no shipped prose uses the retired alignment, status or cleanup vocabulary", async () => {
		const files = await collectScannedFiles();
		expect(files.length).toBeGreaterThan(0);

		const offenders: string[] = [];
		for (const file of files) {
			const rel = relative(REPO_ROOT, file).split(sep).join("/");
			for (const hit of findRetiredVocabulary(await readFile(file, "utf-8"))) {
				offenders.push(`  ${rel}:${hit.line}: ${hit.rule} — ${hit.text}`);
			}
		}

		if (offenders.length > 0) {
			throw new Error(
				`Found ${offenders.length} use(s) of retired AIDE-file vocabulary in shipped prose:\n${offenders.join("\n")}`,
			);
		}
		expect(offenders).toEqual([]);
	}, 30000);

	it("the prose walk covers agents, commands, skills, the methodology docs and README, and skips exclusions", async () => {
		const files = await collectScannedFiles();
		const rels = files.map((f) => relative(REPO_ROOT, f).split(sep).join("/"));
		expect(rels).toContain("README.md");
		expect(rels).toContain(".claude/commands/aide/brain.md");
		expect(rels).toContain(".claude/skills/aide/SKILL.md");
		expect(rels).toContain(".aide/docs/brain-aide.md");
		expect(rels.some((r) => r.startsWith(".claude/agents/"))).toBe(true);
		expect(rels.some((r) => EPHEMERAL_PROSE_FILES.includes(r.split("/").pop() ?? ""))).toBe(false);
		for (const excluded of [
			".claude/agents/kanban/",
			".claude/skills/kanban/",
			".claude/skills/brain/",
			".claude/skills/aide-brain-author/",
		]) {
			expect(rels.some((r) => r.startsWith(excluded))).toBe(false);
		}
	});

	describe("rule self-test", () => {
		it("legacy-spec-field fails on status: aligned|misaligned and passes on alignment", () => {
			expect(brokenRules("frontmatter holds status: aligned")).toContain("legacy-spec-field");
			expect(brokenRules("frontmatter holds status:misaligned")).toContain("legacy-spec-field");
			expect(brokenRules("frontmatter holds alignment: aligned")).not.toContain("legacy-spec-field");
			expect(brokenRules("a plan holds status: approved")).not.toContain("legacy-spec-field");
		});

		it("spec-status-instruction fails on an instruction to put alignment in status and passes otherwise", () => {
			expect(brokenRules("QA sets status: misaligned")).toContain("spec-status-instruction");
			expect(brokenRules("Mark the spec's status as aligned")).toContain("spec-status-instruction");
			expect(brokenRules("write the status field to misaligned")).toContain("spec-status-instruction");
			expect(brokenRules("the aligner sets alignment through aide_frontmatter")).not.toContain(
				"spec-status-instruction",
			);
			expect(brokenRules("the status of the board is aligned with the plan")).not.toContain(
				"spec-status-instruction",
			);
		});

		it("allow-empty-plan fails on the literal option name", () => {
			expect(brokenRules("pass allowEmptyPlan to lift the refusal")).toContain("allow-empty-plan");
			expect(brokenRules("cleanup refuses a plan with no checkboxes")).not.toContain("allow-empty-plan");
		});

		it("in-flight fails on the hyphenated status value and passes on 'in flight'", () => {
			expect(brokenRules("a todo marked in-flight")).toContain("in-flight");
			expect(brokenRules("work that is in flight")).not.toContain("in-flight");
		});

		it("hand-edit fails on hand-edit words beside alignment or status and passes with aide_frontmatter", () => {
			expect(brokenRules("edit the alignment by hand")).toContain("hand-edit");
			expect(brokenRules("hand-edit the status line")).toContain("hand-edit");
			expect(brokenRules("manually flip the status")).toContain("hand-edit");
			expect(
				brokenRules("the aligner sets alignment through aide_frontmatter, never by hand"),
			).not.toContain("hand-edit");
			expect(brokenRules("copy the template by hand")).not.toContain("hand-edit");
			expect(brokenRules("check the alignment of the columns")).not.toContain("hand-edit");
		});

		it("QA sets status: misaligned fails rules 1 and 2 and no other", () => {
			expect(brokenRules("QA sets status: misaligned")).toEqual([
				"legacy-spec-field",
				"spec-status-instruction",
			]);
		});

		it("a clean line passes every rule", () => {
			expect(brokenRules("the aligner sets alignment through aide_frontmatter, never by hand")).toEqual([]);
		});

		it("findRetiredVocabulary reports one entry per line and rule with 1-based line numbers", () => {
			const hits = findRetiredVocabulary("clean line\r\nstatus: aligned\nallowEmptyPlan");
			expect(hits).toEqual([
				{ line: 2, rule: "legacy-spec-field", text: "status: aligned" },
				{ line: 3, rule: "allow-empty-plan", text: "allowEmptyPlan" },
			]);
		});
	});
});
