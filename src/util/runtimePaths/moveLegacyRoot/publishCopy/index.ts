import { randomBytes } from "node:crypto";
import { constants } from "node:fs";
import { copyFile, link, mkdir, rename, unlink } from "node:fs/promises";
import { dirname } from "node:path";

/**
 * Copy `source` to `target` so a reader never sees a half-written file. The target's folder
 * is created, the source is copied to a temp sibling `<target>.<pid>-<hex>.moving` with an
 * exclusive create, and the temp is published whole: `replace: false` hard-links it to the
 * target (`exists` when the target is already there, which is left untouched); `replace: true`
 * renames it over the target. The temp is removed in every outcome. Readers filter on `.jsonl`
 * and `.json`, so they never list it. Any other fs error throws.
 */
export default async function publishCopy({
	source,
	target,
	replace,
}: {
	source: string;
	target: string;
	replace: boolean;
}): Promise<"published" | "exists"> {
	await mkdir(dirname(target), { recursive: true });
	const temp = `${target}.${process.pid}-${randomBytes(4).toString("hex")}.moving`;
	await copyFile(source, temp, constants.COPYFILE_EXCL);
	try {
		if (replace) {
			await rename(temp, target);
			return "published";
		}
		try {
			await link(temp, target);
			return "published";
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code === "EEXIST") return "exists";
			throw error;
		}
	} finally {
		await unlink(temp).catch((error: NodeJS.ErrnoException) => {
			if (error.code !== "ENOENT") throw error;
		});
	}
}
