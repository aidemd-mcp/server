import { isAbsolute, relative, resolve } from "node:path";

/**
 * Turns a path as an event recorded it (absolute, relative, `./`-prefixed,
 * trailing slash) into the project-relative POSIX form tree entries use.
 * Returns null when the path lies outside the project root; the project root
 * itself is `"."`. Pure: touches no file.
 */
export default function normalizeProjectPath({
	projectRoot,
	path,
}: {
	projectRoot: string;
	path: string;
}): string | null {
	// A relative path is read against the project root; an absolute one is used as is.
	const absolute = isAbsolute(path) ? path : resolve(projectRoot, path);
	const rel = relative(projectRoot, absolute);

	// Outside the root: a leading `..` segment, or no relative form at all (another drive).
	if (rel === ".." || rel.startsWith("../") || rel.startsWith("..\\") || isAbsolute(rel)) return null;

	const posix = rel.replace(/\\/g, "/").replace(/\/+$/, "");
	return posix === "" ? "." : posix;
}
