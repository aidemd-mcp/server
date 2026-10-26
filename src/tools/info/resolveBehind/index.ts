import aidePackage from "@/service/install/shared/aidePackage/index.js";
import type { BehindNotice } from "@/types/index.js";
import readAideLaunchMode from "./readAideLaunchMode/index.js";
import fetchPublishedVersions from "./fetchPublishedVersions/index.js";
import listSkippedVersions from "./listSkippedVersions/index.js";
import resolveHighlights from "./resolveHighlights/index.js";
import isVersionBehind from "./shared/isVersionBehind/index.js";

/**
 * Soft notice for any launch kind the project's aide entry uses. `installed`
 * is the running server's own version (for an npx launch that is the pin it
 * started on); `launch` lets the caller offer the matching remedy;
 * `versionsBehind` and `highlights` come from the published release history.
 * Silent (null) when there is no aide entry, the version is unknown, the
 * registry read is offline or fails, or the server is current. Never throws,
 * never gates. Worst-case network time is the registry bound plus the
 * changelog bound (1.5 s + 2 s), the latter only when behind.
 */
export default async function resolveBehind(
	root: string,
	serverVersion: string,
): Promise<BehindNotice | null> {
	// Step 1 — without an aide entry the launch kind, and so the remedy, is unknown.
	const launch = await readAideLaunchMode(root);
	if (launch === null) return null;

	// Step 2 — without a known installed version there is nothing to compare.
	if (serverVersion === "unknown") return null;

	// Step 3 — one registry read gives the latest version and the release list.
	const published = await fetchPublishedVersions(aidePackage.name);
	if (published === null) return null;

	// Step 4 — this comparison alone decides whether a notice appears.
	if (!isVersionBehind(serverVersion, published.latest)) return null;

	// Step 5 — the releases the user would gain by moving to latest.
	const skipped = listSkippedVersions(serverVersion, published.latest, published.versions);

	// Step 6 — enrichment only; a failure yields [] and shrinks the notice.
	const highlights = await resolveHighlights(aidePackage.name, published.latest, skipped);

	// Step 7 — compose the notice.
	return {
		installed: serverVersion,
		latest: published.latest,
		launch,
		versionsBehind: skipped.length,
		highlights,
	};
}
