import type { BrainChangeTarget } from "@/types/index.js";
import locateFrontmatter from "../locateFrontmatter/index.js";
import locateSection from "../locateSection/index.js";

/**
 * Returns the exact current bytes a change would replace, which is also the text a preview
 * hashes and an apply re-hashes: the frontmatter region for the launcher, or the bytes strictly
 * between the section's markers for a marker target. `null` means the target no longer exists
 * in the file (its markers are gone), so there is nothing to offer or to guard.
 *
 * `raw` must already have parsed past the frontmatter (callers refuse unusable files first).
 */
export default function readChangeBefore({ raw, target }: { raw: string; target: BrainChangeTarget }): string | null {
	const { yamlStart, yamlEnd, bodyStart } = locateFrontmatter(raw);
	if (target === "launcher") return raw.slice(yamlStart, yamlEnd);

	const span = locateSection({ raw, bodyStart, marker: target });
	return span ? raw.slice(span.start, span.end) : null;
}
