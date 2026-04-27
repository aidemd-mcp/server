import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Idempotency marker that wraps the methodology block in the host's config
 * file. Framework plumbing — not AIDE doctrine — so it is allowed to live as
 * a literal here. Changing its bytes would break duplicate detection in every
 * host project that already has a methodology block installed, so it must
 * stay byte-stable across refactors.
 */
const METHODOLOGY_MARKER = "<!-- aide-methodology -->";

/**
 * Resolve the repo root relative to this module's own location. Anchoring to
 * import.meta.url (not process.cwd()) is load-bearing: the MCP server is
 * launched from the host project's directory, so cwd points there and would
 * never find the canonical files. src/ and dist/ are siblings under the repo
 * root at the same depth, so the same four-hop walk reaches the root whether
 * this file runs from src/tools/init/initContent/ or dist/tools/init/initContent/.
 * Canonical content lives under two subtrees of the repo root — `.aide/docs/`
 * for methodology and `.claude/commands/aide/` for slash command templates —
 * so DOC_PATHS values carry the subtree prefix and we resolve from the root.
 */
const MODULE_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(MODULE_DIR, "..", "..", "..", "..");

/**
 * Canonical-name → repo-relative-path registry. Consumers ask for content by
 * canonical name; the file layout under the repo root is this helper's
 * private concern and never crosses the interface. If the canonical layout
 * is reorganized, only this map changes.
 */
const DOC_PATHS = {
	"index": ".aide/docs/index.md",
	"aide-spec": ".aide/docs/aide-spec.md",
	"aide-template": ".aide/docs/aide-template.md",
	"progressive-disclosure": ".aide/docs/progressive-disclosure.md",
	"agent-readable-code": ".aide/docs/agent-readable-code.md",
	"automated-qa": ".aide/docs/automated-qa.md",
	"commands/aide/research": ".claude/commands/aide/research.md",
	"commands/aide/spec": ".claude/commands/aide/spec.md",
	"commands/aide/plan": ".claude/commands/aide/plan.md",
	"commands/aide/build": ".claude/commands/aide/build.md",
	"commands/aide/qa": ".claude/commands/aide/qa.md",
	"commands/aide/fix": ".claude/commands/aide/fix.md",
	"plan-aide": ".aide/docs/plan-aide.md",
	"todo-aide": ".aide/docs/todo-aide.md",
	"brain-aide": ".aide/docs/brain-aide.md",
	"commands/aide/synthesize": ".claude/commands/aide/synthesize.md",
	"commands/aide/upgrade": ".claude/commands/aide/upgrade.md",
	"commands/aide/update-playbook": ".claude/commands/aide/update-playbook.md",
	"commands/aide/aide": ".claude/commands/aide.md",
	"commands/aide/refactor": ".claude/commands/aide/refactor.md",
	"commands/aide/brain": ".claude/commands/aide/brain.md",
	"agents/aide/aide-spec-writer": ".claude/agents/aide/aide-spec-writer.md",
	"agents/aide/aide-domain-expert": ".claude/agents/aide/aide-domain-expert.md",
	"agents/aide/aide-strategist": ".claude/agents/aide/aide-strategist.md",
	"agents/aide/aide-architect": ".claude/agents/aide/aide-architect.md",
	"agents/aide/aide-implementor": ".claude/agents/aide/aide-implementor.md",
	"agents/aide/aide-qa": ".claude/agents/aide/aide-qa.md",
	"agents/aide/aide-auditor": ".claude/agents/aide/aide-auditor.md",
	"agents/aide/aide-aligner": ".claude/agents/aide/aide-aligner.md",
	"agents/aide/aide-explorer": ".claude/agents/aide/aide-explorer.md",
	"commands/aide/align": ".claude/commands/aide/align.md",
	"cascading-alignment": ".aide/docs/cascading-alignment.md",
	"skills/study-playbook": ".claude/skills/study-playbook/SKILL.md",
	"skills/brain": ".claude/skills/brain/SKILL.md",
	"bin/aide-tree": ".aide/bin/aide-tree.mjs",
} as const;

export type CanonicalDocName = keyof typeof DOC_PATHS;

/**
 * An entry in the methodology-doc enumeration. Consumers iterate this list
 * to install the methodology subset into the host-side doc directory — the
 * `canonical` field is the lookup key into `readCanonicalDoc`, and the
 * `hostFilename` is the basename to write under the host doc directory.
 */
export interface MethodologyDocEntry {
	readonly canonical: CanonicalDocName;
	readonly hostFilename: string;
}

/**
 * The canonical list of methodology docs that ship into the host-side doc
 * directory. Ordering is the doc index reading order and therefore stable —
 * adding a new methodology doc appends to the end. Owning this list here
 * (alongside the name-to-path registry it depends on) is load-bearing: the
 * parent spec's single-reader invariant extends to enumeration, so downstream
 * consumers iterate this list rather than hardcoding the membership of
 * "the methodology" in their own source.
 */
const METHODOLOGY_DOCS: readonly MethodologyDocEntry[] = [
	{ canonical: "index", hostFilename: "index.md" },
	{ canonical: "aide-spec", hostFilename: "aide-spec.md" },
	{ canonical: "aide-template", hostFilename: "aide-template.md" },
	{ canonical: "progressive-disclosure", hostFilename: "progressive-disclosure.md" },
	{ canonical: "agent-readable-code", hostFilename: "agent-readable-code.md" },
	{ canonical: "automated-qa", hostFilename: "automated-qa.md" },
	{ canonical: "plan-aide", hostFilename: "plan-aide.md" },
	{ canonical: "todo-aide", hostFilename: "todo-aide.md" },
	{ canonical: "brain-aide", hostFilename: "brain-aide.md" },
	{ canonical: "cascading-alignment", hostFilename: "cascading-alignment.md" },
];

/**
 * An entry in the agent-doc enumeration. Consumers iterate this list to
 * install the pipeline agent files into the host's agent directory.
 */
export interface AgentDocEntry {
	readonly canonical: CanonicalDocName;
	readonly hostFilename: string;
}

/**
 * An entry in the skill-doc enumeration. Consumers iterate this list to
 * install skill templates into the host's skill directory.
 */
export interface SkillDocEntry {
	readonly canonical: CanonicalDocName;
	readonly hostPath: string;
}

/**
 * The canonical list of pipeline agent files that ship into the host's
 * agent directory. Ordering is pipeline phase order.
 */
const AGENT_DOCS: readonly AgentDocEntry[] = [
	{ canonical: "agents/aide/aide-spec-writer", hostFilename: "aide/aide-spec-writer.md" },
	{ canonical: "agents/aide/aide-domain-expert", hostFilename: "aide/aide-domain-expert.md" },
	{ canonical: "agents/aide/aide-strategist", hostFilename: "aide/aide-strategist.md" },
	{ canonical: "agents/aide/aide-architect", hostFilename: "aide/aide-architect.md" },
	{ canonical: "agents/aide/aide-implementor", hostFilename: "aide/aide-implementor.md" },
	{ canonical: "agents/aide/aide-qa", hostFilename: "aide/aide-qa.md" },
	{ canonical: "agents/aide/aide-auditor", hostFilename: "aide/aide-auditor.md" },
	{ canonical: "agents/aide/aide-aligner", hostFilename: "aide/aide-aligner.md" },
	{ canonical: "agents/aide/aide-explorer", hostFilename: "aide/aide-explorer.md" },
];

/**
 * The canonical list of skill templates that ship into the host's skill
 * directory.
 */
const SKILL_DOCS: readonly SkillDocEntry[] = [
	{ canonical: "skills/study-playbook", hostPath: "study-playbook/SKILL.md" },
	{ canonical: "skills/brain", hostPath: "brain/SKILL.md" },
];

/** Per-process cache. Populated from disk reads in this process only — never
 * from build-time-embedded content. Keyed by canonical name. */
const cache = new Map<CanonicalDocName, string>();

/**
 * Read one canonical doc verbatim from disk by canonical name. The returned
 * string is byte-identical to the file on disk: no trimming, no normalization,
 * no frontmatter stripping, no link rewriting. Composition is the consumer's
 * concern and lives downstream. Throws a clear error naming the canonical
 * name and the resolved path on any read failure — there is no fallback to
 * an embedded default, because shipping invented content is exactly the
 * failure mode this helper exists to prevent.
 */
export function readCanonicalDoc(name: CanonicalDocName): string {
	const cached = cache.get(name);
	if (cached !== undefined) return cached;

	const filePath = join(REPO_ROOT, DOC_PATHS[name]);
	let bytes: string;
	try {
		bytes = readFileSync(filePath, "utf-8");
	} catch (cause) {
		throw new Error(
			`initContent: canonical doc "${name}" not readable at ${filePath}`,
			{ cause },
		);
	}
	cache.set(name, bytes);
	return bytes;
}

/** Return the idempotency marker used to detect existing methodology. */
export function getMethodologyMarker(): string {
	return METHODOLOGY_MARKER;
}

/**
 * Return the repo-relative path for a canonical doc name. Exposes the
 * private DOC_PATHS registry through a thin accessor so downstream
 * consumers (e.g. enumerateArtifacts) can resolve paths without
 * duplicating the registry.
 */
export function getCanonicalPath(name: CanonicalDocName): string {
	return DOC_PATHS[name];
}

/**
 * Return the canonical enumeration of methodology docs that belong in the
 * host-side doc directory. Consumers iterate the returned list rather than
 * maintaining their own local copy — hardcoding the membership of "the
 * methodology" anywhere else under the init subtree would be a second
 * source of truth for the same decision and would silently drift on the
 * next canonical-doc addition.
 */
export function listMethodologyDocs(): readonly MethodologyDocEntry[] {
	return METHODOLOGY_DOCS;
}

/**
 * Return the canonical enumeration of pipeline agent files that belong in
 * the host's agent directory.
 */
export function listAgents(): readonly AgentDocEntry[] {
	return AGENT_DOCS;
}

/**
 * Return the canonical enumeration of skill templates that belong in the
 * host's skill directory.
 */
export function listSkills(): readonly SkillDocEntry[] {
	return SKILL_DOCS;
}
