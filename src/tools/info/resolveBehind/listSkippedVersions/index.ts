import isVersionBehind from "../shared/isVersionBehind/index.js";

const EXACT_VERSION = /^\d+\.\d+\.\d+$/;

/**
 * The published releases a user on `installed` would gain by moving to
 * `latest`, newest first. Its length is the notice's `versionsBehind`, and the
 * list scopes which changelog sections may supply highlights. Prereleases and
 * build tags are not releases the user would be offered, so they are dropped.
 */
export default function listSkippedVersions(
	installed: string,
	latest: string,
	versions: string[],
): string[] {
	return versions
		.filter((version) => EXACT_VERSION.test(version))
		.filter((version) => isVersionBehind(installed, version))
		.filter((version) => !isVersionBehind(latest, version))
		.sort((a, b) => {
			if (isVersionBehind(a, b)) return 1;
			if (isVersionBehind(b, a)) return -1;
			return 0;
		});
}
