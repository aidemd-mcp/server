const REGISTRY_URL = "https://registry.npmjs.org";
const TIMEOUT_MS = 1500;

/**
 * Ask the npm registry for the latest published version of a package.
 * Bounded by a 1.5 s abort. Returns null on any failure: network error,
 * timeout, non-2xx, bad JSON, or a missing version. Never throws.
 */
export default async function fetchLatestVersion(packageName: string): Promise<string | null> {
	try {
		const response = await fetch(`${REGISTRY_URL}/${packageName}/latest`, {
			signal: AbortSignal.timeout(TIMEOUT_MS),
		});
		if (!response.ok) return null;
		const json = (await response.json()) as { version?: unknown };
		return typeof json.version === "string" && json.version.length > 0 ? json.version : null;
	} catch {
		return null;
	}
}
