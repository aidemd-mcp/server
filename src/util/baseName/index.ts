/**
 * The last non-empty segment of a recorded path, whichever separator (`/` or `\`) it was written
 * with; the path itself when it has no segment. Pure string work with no Node imports, so the
 * observer's browser page imports it as readily as the server does.
 */
export default function baseName(path: string): string {
	const segments = path.split(/[\\/]/).filter((segment) => segment !== "");
	return segments[segments.length - 1] ?? path;
}
