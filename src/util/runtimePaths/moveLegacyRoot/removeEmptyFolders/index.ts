import { rmdir } from "node:fs/promises";

/**
 * Remove each of `folders`, in the given order, with a non-recursive `rmdir`. Every error is
 * ignored: a folder that still holds something (a file that could not be moved, an unknown
 * file) or no longer exists stays by design.
 */
export default async function removeEmptyFolders({ folders }: { folders: string[] }): Promise<void> {
	for (const folder of folders) {
		await rmdir(folder).catch(() => undefined);
	}
}
