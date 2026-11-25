import { lstat } from "node:fs/promises";

/** True when nothing exists at `file` any more: another mover took a legacy file after it was listed. Any other fs error throws. */
export default async function isGone({ file }: { file: string }): Promise<boolean> {
	return lstat(file).then(
		() => false,
		(error: NodeJS.ErrnoException) => {
			if (error.code === "ENOENT") return true;
			throw error;
		},
	);
}
