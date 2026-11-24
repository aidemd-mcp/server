import { realpath, stat } from "node:fs/promises";
import { isAbsolute, relative, resolve, sep } from "node:path";

/** What the confinement check decided about a requested path. */
export type ConfinedPath =
	| { kind: "ok"; file: string; relativePath: string }
	| { kind: "refused" }
	| { kind: "missing" }
	| { kind: "not-a-file" };

const DRIVE_LETTER = /^[a-zA-Z]:/;
const MISSING_CODES = ["ENOENT", "ENOTDIR"];

/** True when a path produced by `relative` leads out of its base (or onto another drive). */
function isOutside(relativePath: string): boolean {
	return relativePath === ".." || relativePath.startsWith(`..${sep}`) || isAbsolute(relativePath);
}

/** True for strings that must never reach the filesystem: NUL, UNC and device prefixes, foreign drive letters. */
function isForbiddenSyntax(requested: string): boolean {
	if (requested.includes("\0")) return true;
	if (/^[\\/]{2}/.test(requested)) return true;
	return process.platform !== "win32" && DRIVE_LETTER.test(requested);
}

/** Resolves a path to its real location, or null when nothing is there. */
async function realpathOrNull(path: string): Promise<string | null> {
	try {
		return await realpath(path);
	} catch (error) {
		if (MISSING_CODES.includes((error as NodeJS.ErrnoException).code ?? "")) return null;
		throw error;
	}
}

/**
 * Turns the requested path into a real regular file strictly inside the project root, or a typed
 * refusal. A project root that is not absolute is refused outright (defense in depth behind
 * `findProject`). The text is checked first (NUL, UNC and device prefixes, foreign drive letters), then
 * the lexical path (so nothing outside the root is ever touched, not even by `realpath`), then
 * the real paths of the root and the target (so a symlink or junction pointing out is refused).
 * Directories are never listed.
 */
export default async function resolveConfinedPath({
	projectRoot,
	requested,
}: {
	projectRoot: string;
	requested: string;
}): Promise<ConfinedPath> {
	// 0. A project root that is not absolute would resolve against the observer's own working
	// folder, which belongs to another project; confinement to it is meaningless.
	if (!isAbsolute(projectRoot)) return { kind: "refused" };

	// 1. Refuse by text before any filesystem access.
	if (isForbiddenSyntax(requested)) return { kind: "refused" };

	// 2. Lexical containment: `relative` yields an absolute path when the target is on another drive.
	const lexical = resolve(projectRoot, requested);
	if (isOutside(relative(projectRoot, lexical))) return { kind: "refused" };

	// 3. Real-path containment: catches symlinks and junctions pointing out of the root.
	const realRoot = await realpath(projectRoot);
	const realTarget = await realpathOrNull(lexical);
	if (realTarget === null) return { kind: "missing" };
	const relativePath = relative(realRoot, realTarget);
	if (isOutside(relativePath)) return { kind: "refused" };

	// 4. Only a regular file is served.
	const stats = await stat(realTarget);
	if (!stats.isFile()) return { kind: "not-a-file" };

	return { kind: "ok", file: realTarget, relativePath: relativePath.split(sep).join("/") };
}
