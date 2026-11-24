import { mkdir, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve } from "node:path";

/** The absolute target of a root-relative path, or null when it would land outside the root. */
function resolveInside({ projectRoot, path }: { projectRoot: string; path: string }): string | null {
	if (isAbsolute(path)) return null;
	const target = resolve(projectRoot, path);
	const fromRoot = relative(projectRoot, target);
	if (fromRoot === "" || fromRoot.startsWith("..") || isAbsolute(fromRoot)) return null;
	return target;
}

/**
 * Writes each file under the project root, creating its folders. Every path is checked before the
 * first write, and one that resolves outside the root (absolute, or climbing with `..`) throws with
 * nothing written.
 */
export default async function writeProjectFiles({
	projectRoot,
	files,
}: {
	projectRoot: string;
	files: Record<string, string>;
}): Promise<void> {
	const targets = Object.entries(files).map(([path, content]) => {
		const target = resolveInside({ projectRoot, path });
		if (target === null) throw new Error(`Fixture file "${path}" resolves outside the project root.`);
		return { target, content };
	});

	for (const { target, content } of targets) {
		await mkdir(dirname(target), { recursive: true });
		await writeFile(target, content, "utf-8");
	}
}
