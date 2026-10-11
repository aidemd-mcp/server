import { realpath } from "node:fs/promises";
import path from "node:path";

/** Where a draft path lands relative to the project; `inside` carries the path to read, `absent` means nothing exists there. */
export type DraftPathResolution =
	| { kind: "inside"; absolutePath: string; relativePath: string }
	| { kind: "absent"; relativePath: string }
	| { kind: "outside" };

/** True when `target` is not at or below `base` (a `..` escape, or another drive). */
function escapes(base: string, target: string): boolean {
	const relative = path.relative(base, target);
	if (path.isAbsolute(relative)) return true;
	return relative === ".." || relative.startsWith(`..${path.sep}`);
}

/**
 * Decides whether a draft path may be read: it must stay inside the project
 * both lexically and after symlinks resolve, so a link inside the project
 * cannot be used to read a file outside it. A lexically-inside path with no
 * file is `absent`. Never reads file contents.
 */
export default async function resolveDraftPath({
	root,
	path: draftPath,
}: {
	root: string;
	path: string;
}): Promise<DraftPathResolution> {
	const lexical = path.resolve(root, draftPath);
	if (escapes(path.resolve(root), lexical)) return { kind: "outside" };

	const relativePath = path.relative(path.resolve(root), lexical).split(path.sep).join("/");

	let real: string;
	try {
		real = await realpath(lexical);
	} catch (err) {
		if ((err as NodeJS.ErrnoException).code === "ENOENT") return { kind: "absent", relativePath };
		// Not a missing file (e.g. a permissions fault) - the read reports it by name.
		return { kind: "inside", absolutePath: lexical, relativePath };
	}

	if (escapes(await realpath(root), real)) return { kind: "outside" };
	return { kind: "inside", absolutePath: real, relativePath };
}
