import { realpath, stat } from "node:fs/promises";
import { isAbsolute, relative, resolve, sep } from "node:path";
import type { FrontmatterRefusal } from "../types/index.js";

type ResolvedTarget =
	| { kind: "ok"; abs: string; rel: string }
	| {
			kind: "refused";
			refusal: Extract<FrontmatterRefusal, { kind: "outside-root" | "missing" | "not-a-file" }>;
	  };

/**
 * Turns the caller's path into a real regular file strictly inside the project
 * root, or returns a typed refusal. Both the root and the target pass through
 * `realpath` so a symlink or junction cannot smuggle the target out of the root,
 * and containment is checked before `stat` so nothing outside the root is
 * inspected beyond `realpath`. `rel` is POSIX and relative to the root.
 */
export default async function resolveTarget({
	root,
	path,
}: {
	root: string;
	path: string;
}): Promise<ResolvedTarget> {
	// Relative paths join the root; absolute paths are taken as-is.
	const target = resolve(root, path);

	const realRoot = await realpath(root);
	const realTarget = await realpath(target).catch((error: NodeJS.ErrnoException) => {
		if (error.code === "ENOENT") return null;
		throw error;
	});
	if (realTarget === null) return { kind: "refused", refusal: { kind: "missing" } };

	// On Windows, `relative` returns an absolute path when the target is on another drive.
	const relativePath = relative(realRoot, realTarget);
	const isOutside = relativePath === ".." || relativePath.startsWith(`..${sep}`) || isAbsolute(relativePath);
	if (isOutside) return { kind: "refused", refusal: { kind: "outside-root" } };

	const stats = await stat(realTarget);
	if (!stats.isFile()) return { kind: "refused", refusal: { kind: "not-a-file" } };

	return { kind: "ok", abs: realTarget, rel: relativePath.split(sep).join("/") };
}
