import type { PublishedVersions } from "@/types/index.js";

const REGISTRY_URL = "https://registry.npmjs.org";
const TIMEOUT_MS = 1500;
const ABBREVIATED_METADATA = "application/vnd.npm.install-v1+json";

/**
 * The single registry read per boot: one request gives both the latest
 * version that gates the version notice and the full release list the notice
 * is counted against. It asks for npm's abbreviated metadata document because
 * the full one is several times larger. Bounded by a 1.5 s abort. Returns
 * null on network error, timeout, non-2xx, bad JSON or a malformed document.
 * Never throws.
 */
export default async function fetchPublishedVersions(packageName: string): Promise<PublishedVersions | null> {
	try {
		const response = await fetch(`${REGISTRY_URL}/${packageName}`, {
			headers: { Accept: ABBREVIATED_METADATA },
			signal: AbortSignal.timeout(TIMEOUT_MS),
		});
		if (!response.ok) return null;

		const body = (await response.json()) as {
			"dist-tags"?: { latest?: unknown };
			versions?: unknown;
		};
		const latest = body["dist-tags"]?.latest;
		if (typeof latest !== "string" || latest.length === 0) return null;
		if (typeof body.versions !== "object" || body.versions === null) return null;

		const versions = Object.keys(body.versions);
		if (!versions.includes(latest)) return null;

		return { latest, versions };
	} catch {
		return null;
	}
}
