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
 * Resolve the canonical docs/ folder relative to this module's own location.
 * Anchoring to import.meta.url (not process.cwd()) is load-bearing: the MCP
 * server is launched from the host project's directory, so cwd points there
 * and would never find docs/. src/ and dist/ are siblings under the repo
 * root at the same depth, so the same four-hop walk works whether this file
 * runs from src/tools/init/initContent/ or dist/tools/init/initContent/.
 */
const MODULE_DIR = dirname(fileURLToPath(import.meta.url));
const DOCS_ROOT = join(MODULE_DIR, "..", "..", "..", "..", "docs");

/**
 * Canonical-name → relative-path registry. Consumers ask for content by
 * canonical name; the file layout under docs/ is this helper's private
 * concern and never crosses the interface. If docs/ is reorganized, only
 * this map changes.
 */
const DOC_PATHS = {
	"aide-spec": "aide-spec.md",
	"aide-template": "aide-template.md",
	"progressive-disclosure": "progressive-disclosure.md",
	"agent-readable-code": "agent-readable-code.md",
	"automated-qa": "automated-qa.md",
	"methodology-stub": "methodology-stub.md",
	"commands/aide/research": "commands/aide/research.md",
	"commands/aide/spec": "commands/aide/spec.md",
	"commands/aide/plan": "commands/aide/plan.md",
	"commands/aide/build": "commands/aide/build.md",
	"commands/aide/qa": "commands/aide/qa.md",
	"commands/aide/fix": "commands/aide/fix.md",
} as const;

export type CanonicalDocName = keyof typeof DOC_PATHS;

/**
 * An entry in the methodology-doc enumeration. Consumers iterate this list
 * to install the methodology subset into the host-side doc hub — the
 * `canonical` field is the lookup key into `readCanonicalDoc`, and the
 * `hostFilename` is the basename to write under the host hub directory.
 */
export interface MethodologyDocEntry {
	readonly canonical: CanonicalDocName;
	readonly hostFilename: string;
}

/**
 * The canonical list of methodology docs that ship into the host-side doc
 * hub. Ordering is the hub's reading order and therefore stable — adding a
 * new methodology doc appends to the end. Owning this list here (alongside
 * the name-to-path registry it depends on) is load-bearing: the parent
 * spec's single-reader invariant extends to enumeration, so downstream
 * consumers iterate this list rather than hardcoding the membership of
 * "the methodology" in their own source.
 */
const METHODOLOGY_DOCS: readonly MethodologyDocEntry[] = [
	{ canonical: "aide-spec", hostFilename: "aide-spec.md" },
	{ canonical: "aide-template", hostFilename: "aide-template.md" },
	{ canonical: "progressive-disclosure", hostFilename: "progressive-disclosure.md" },
	{ canonical: "agent-readable-code", hostFilename: "agent-readable-code.md" },
	{ canonical: "automated-qa", hostFilename: "automated-qa.md" },
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

	const filePath = join(DOCS_ROOT, DOC_PATHS[name]);
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
 * Return the canonical enumeration of methodology docs that belong in the
 * host-side doc hub. Consumers iterate the returned list rather than
 * maintaining their own local copy — hardcoding the membership of "the
 * methodology" anywhere else under the init subtree would be a second
 * source of truth for the same decision and would silently drift on the
 * next canonical-doc addition.
 */
export function listMethodologyDocs(): readonly MethodologyDocEntry[] {
	return METHODOLOGY_DOCS;
}
