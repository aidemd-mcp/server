import { isAbsolute, relative } from "node:path";
import { realpath } from "node:fs/promises";

/** Lowercases real paths on win32, where the file system ignores case. */
function normalize(path: string): string {
	return process.platform === "win32" ? path.toLowerCase() : path;
}

/**
 * Real-path containment: true only when `path` resolves to somewhere strictly inside `folder`,
 * so symlinks and `..` segments cannot lead outside it. Any fs error counts as outside; never throws.
 */
export default async function isInsideFolder({ folder, path }: { folder: string; path: string }): Promise<boolean> {
	try {
		const realFolder = normalize(await realpath(folder));
		const realPath = normalize(await realpath(path));
		const relation = relative(realFolder, realPath);
		if (relation === "") return false;
		if (relation.startsWith("..")) return false;
		return !isAbsolute(relation);
	} catch {
		return false;
	}
}
