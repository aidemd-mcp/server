const CDN_URL = "https://cdn.jsdelivr.net/npm";
const TIMEOUT_MS = 2000;

/**
 * Reads the changelog shipped in the given published version (the package's
 * `files` include `CHANGELOG.md`), because the running server only bundles its
 * own, older changelog. The CDN path is pinned to the exact version so a stale
 * "latest" alias cannot serve older notes. Bounded by a 2 s abort. Returns
 * null on any failure (network error, timeout, non-2xx, unreadable body),
 * which only shrinks the notice. Never throws.
 */
export default async function fetchChangelog(packageName: string, version: string): Promise<string | null> {
	try {
		const response = await fetch(`${CDN_URL}/${packageName}@${version}/CHANGELOG.md`, {
			signal: AbortSignal.timeout(TIMEOUT_MS),
		});
		if (!response.ok) return null;

		return await response.text();
	} catch {
		return null;
	}
}
