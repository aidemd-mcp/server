import { unlink } from "node:fs/promises";

/** Unlink `file`; a file that is already gone (`ENOENT`, another mover took it) is not an error. Any other error throws. */
export default async function unlinkIfPresent({ file }: { file: string }): Promise<void> {
	await unlink(file).catch((error: NodeJS.ErrnoException) => {
		if (error.code !== "ENOENT") throw error;
	});
}
