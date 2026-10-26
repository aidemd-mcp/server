/** Parse `major.minor.patch`, ignoring any `-prerelease` / `+build` suffix. */
function parseTriple(version: string): [number, number, number] | null {
	const match = /^(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/.exec(version.trim());
	if (!match) return null;
	return [Number(match[1]), Number(match[2]), Number(match[3])];
}

/**
 * True iff `latest` is strictly greater than `installed` by numeric
 * major.minor.patch comparison. Prerelease and build suffixes are ignored.
 * Returns false when either value is unparseable.
 */
export default function isVersionBehind(installed: string, latest: string): boolean {
	const a = parseTriple(installed);
	const b = parseTriple(latest);
	if (!a || !b) return false;
	for (let i = 0; i < 3; i++) {
		if (b[i] !== a[i]) return b[i] > a[i];
	}
	return false;
}
