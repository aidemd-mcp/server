import { realpath, stat } from "node:fs/promises";
import { isAbsolute, relative, resolve, sep } from "node:path";
import type { CleanupRefusal } from "@/types/index.js";

type ResolvedModule =
	| { kind: "ok"; dir: string; module: string }
	| { kind: "refused"; module: string; refusal: CleanupRefusal };

/**
 * Turns the caller's module path into a real directory strictly inside, or
 * equal to, the project root, or returns a typed refusal. Both the root and
 * the target are passed through `realpath` so a symlink or junction cannot
 * smuggle the target out of the root. Containment is checked before `stat`,
 * so nothing outside the root is ever inspected beyond `realpath`. Never
 * lists a directory.
 */
export default async function resolveModule(root: string, path: string): Promise<ResolvedModule> {
	// Relative paths join the root; absolute paths are taken as-is.
	const target = resolve(root, path);

	const realRoot = await realpath(root);
	const realTarget = await realpath(target).catch((error: NodeJS.ErrnoException) => {
		if (error.code === "ENOENT") return null;
		throw error;
	});
	if (realTarget === null) {
		return { kind: "refused", module: path, refusal: { kind: "missing" } };
	}

	// On Windows, `relative` returns an absolute path when the target is on another drive.
	const relativePath = relative(realRoot, realTarget);
	const isOutside = relativePath === ".." || relativePath.startsWith(`..${sep}`) || isAbsolute(relativePath);
	if (isOutside) {
		return { kind: "refused", module: path, refusal: { kind: "outside-root" } };
	}

	const module = relativePath.split(sep).join("/") || ".";

	const stats = await stat(realTarget);
	if (!stats.isDirectory()) {
		return { kind: "refused", module, refusal: { kind: "not-a-directory" } };
	}

	return { kind: "ok", dir: realTarget, module };
}
