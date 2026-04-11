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
	"commands/aide/research": "commands/aide/research.md",
	"commands/aide/spec": "commands/aide/spec.md",
	"commands/aide/build": "commands/aide/build.md",
	"commands/aide/qa": "commands/aide/qa.md",
	"commands/aide/fix": "commands/aide/fix.md",
} as const;

export type CanonicalDocName = keyof typeof DOC_PATHS;

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
