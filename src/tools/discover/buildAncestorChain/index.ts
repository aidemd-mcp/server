import { readFile } from "node:fs/promises";
import { join, relative, dirname } from "node:path";
import parseFrontmatter from "@/util/parseFrontmatter/index.js";

/**
 * Walk from `targetPath` up to `root`, collecting .aide specs at each directory
 * level along the way. Renders them top-down (root first, target-parent last)
 * so agents read broadest context first before drilling into the subtree.
 *
 * The target directory's own specs are excluded — those appear in the subtree
 * section rendered by buildTree. This function is concerned only with the
 * inherited lineage above the target.
 *
 * Root-level spec detection uses the canonical `.aide/intent.aide` path
 * (per aide-spec.md placement rules). At all other directory levels, checks
 * `.aide` first, then falls back to `intent.aide`.
 *
 * Returns `"Ancestor chain:\n" + lines` when at least one ancestor spec is
 * found, or an empty string if the target is the root (no ancestors above it).
 */
export default async function buildAncestorChain(root: string, targetPath: string): Promise<string> {
	// Normalize to absolute paths
	const absRoot = root.replace(/\\/g, "/");
	const absTarget = targetPath.replace(/\\/g, "/");

	// No ancestors when the target IS the root
	if (absTarget === absRoot) return "";

	/** Walk upward from target's parent to root, collecting directory levels. */
	const levels: string[] = [];
	let current = dirname(absTarget);

	while (true) {
		levels.push(current);
		if (current === absRoot) break;
		const parent = dirname(current);
		// Guard against hitting the filesystem root (should not happen in practice)
		if (parent === current) break;
		current = parent;
	}

	// levels is ordered target-parent → root; reverse for root-first rendering
	levels.reverse();

	/** Try to read a file, returning null if it does not exist. */
	async function tryRead(filePath: string): Promise<string | null> {
		try {
			return await readFile(filePath, "utf-8");
		} catch {
			return null;
		}
	}

	/** Resolve which spec file to use at a given directory level, if any. */
	async function resolveSpec(dir: string): Promise<{ specPath: string; content: string } | null> {
		const isRoot = dir === absRoot;

		if (isRoot) {
			// Root-level spec lives at .aide/intent.aide per AIDE placement rules
			const rootSpec = join(dir, ".aide", "intent.aide");
			const content = await tryRead(rootSpec);
			if (content !== null) return { specPath: rootSpec, content };
			return null;
		}

		// Non-root: check .aide first, then intent.aide
		const dotAide = join(dir, ".aide");
		const intentAide = join(dir, "intent.aide");

		const dotAideContent = await tryRead(dotAide);
		if (dotAideContent !== null) return { specPath: dotAide, content: dotAideContent };

		const intentAideContent = await tryRead(intentAide);
		if (intentAideContent !== null) return { specPath: intentAide, content: intentAideContent };

		return null;
	}

	const lines: string[] = [];

	for (const dir of levels) {
		const spec = await resolveSpec(dir);
		if (!spec) continue;

		const { frontmatter, parseError } = parseFrontmatter(spec.content);
		const description = frontmatter?.description || (frontmatter?.intent ? frontmatter.intent.split(/[.\n]/)[0] : undefined);
		const status = frontmatter?.status;

		// Compute a display path relative to the project root
		const rel = relative(absRoot, spec.specPath).replace(/\\/g, "/");
		const displayPath = rel || spec.specPath;

		let line = `  ${displayPath}`;
		if (description) {
			line += ` — ${description}`;
		}
		// Status badge renders whenever set, regardless of whether description is present
		if (status === "aligned" || status === "misaligned") {
			line += ` [${status}]`;
		}
		if (parseError) {
			line += ` ⚠ YAML parse error: ${parseError}`;
		}
		// If no description and no status, show path alone (no em-dash, no fabrication)

		lines.push(line);
	}

	if (lines.length === 0) return "";

	return `Ancestor chain:\n${lines.join("\n")}`;
}
