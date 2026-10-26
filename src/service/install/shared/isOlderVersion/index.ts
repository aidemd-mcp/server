/** Matches an exact `major.minor.patch` version with no range, tag or prerelease part. */
const EXACT_VERSION = /^\d+\.\d+\.\d+$/;

/**
 * Says whether `version` is strictly older than `pin`, so a stale npx pin (a
 * brain launcher's or the aide entry's) can be told apart from a current or
 * newer one. Only exact `X.Y.Z` strings are comparable: `latest`, ranges and prereleases return false because no order can
 * be judged safely. Pure.
 */
export default function isOlderVersion(version: string, pin: string): boolean {
	if (!EXACT_VERSION.test(version) || !EXACT_VERSION.test(pin)) return false;

	const versionParts = version.split(".").map(Number);
	const pinParts = pin.split(".").map(Number);
	for (let index = 0; index < 3; index++) {
		if (versionParts[index] !== pinParts[index]) return versionParts[index]! < pinParts[index]!;
	}
	return false;
}
