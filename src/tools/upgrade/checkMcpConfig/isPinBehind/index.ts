import isOlderVersion from "@/service/install/shared/isOlderVersion/index.js";

const PRERELEASE = /^(\d+\.\d+\.\d+)-[0-9A-Za-z.-]+$/;

/**
 * Says whether a local aide entry's pin should move to `target`. A missing pin
 * (`null`) and a non-exact pin such as `latest` or `^0.12.0` move; an exact pin
 * moves only when it is older than the target. An equal pin is already current,
 * and a pin ahead of the target is never moved back. A prerelease pin is judged
 * by its `x.y.z`: ahead when that is newer than the target, otherwise moved,
 * since a prerelease sorts before its release. Pure.
 */
export default function isPinBehind(version: string | null, target: string): boolean {
	if (version === null) return true;
	if (version === target) return false;
	const pin = PRERELEASE.exec(version)?.[1] ?? version;
	return !isOlderVersion(target, pin);
}
