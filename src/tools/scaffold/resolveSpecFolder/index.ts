import { isAbsolute, join, resolve } from "node:path";

/**
 * Decides where an intent-family file lands. The project root's intent spec
 * lives in the project's `.aide` folder, never as a bare `<root>/.aide` file
 * (that name is the methodology folder), so both the project root and its
 * `.aide` folder resolve to `<root>/.aide` and report `holdsRootSpec`. Any
 * other directory resolves to its own absolute path. A module folder that is
 * merely named `.aide` below the root is a module folder, not the project's
 * `.aide` folder. Pure: no filesystem access; paths compare
 * case-insensitively on Windows.
 */
export default function resolveSpecFolder({
	root,
	directory,
}: {
	root: string;
	directory: string;
}): { folder: string; holdsRootSpec: boolean } {
	const resolved = resolve(isAbsolute(directory) ? directory : join(root, directory));
	const normalize = (path: string) =>
		process.platform === "win32" ? path.toLowerCase() : path;

	const target = normalize(resolved);
	const holdsRootSpec =
		target === normalize(resolve(root)) ||
		target === normalize(resolve(root, ".aide"));

	if (holdsRootSpec) return { folder: join(root, ".aide"), holdsRootSpec };
	return { folder: resolved, holdsRootSpec };
}
