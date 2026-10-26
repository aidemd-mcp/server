import fetchChangelog from "./fetchChangelog/index.js";
import pickHighlights from "./pickHighlights/index.js";

/**
 * The enrichment half of the version notice: reads the changelog shipped in
 * the latest published version and picks the highlights from the releases the
 * user skipped. It never decides whether a notice appears, and any failure
 * yields `[]`, which only shrinks the notice. Never throws.
 */
export default async function resolveHighlights(
	packageName: string,
	latest: string,
	skipped: string[],
): Promise<string[]> {
	// 1. Fetch the changelog shipped in the latest version
	const changelog = await fetchChangelog(packageName, latest);
	if (changelog === null) return [];

	// 2. Pick the highlights from the skipped releases
	return pickHighlights(changelog, skipped);
}
