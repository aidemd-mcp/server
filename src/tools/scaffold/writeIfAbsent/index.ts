import { writeFile } from "node:fs/promises";

/**
 * Writes `content` to `target` only when nothing exists there yet. Scaffold's
 * never-overwrite guarantee lives here: the exclusive-create flag (`wx`) makes
 * the existence check and the write one operation, so a file that appears
 * between a caller's check and this write is never clobbered. An existing
 * target, filled or empty, is left untouched and reported as `"exists"`; every
 * other error propagates unchanged. Parent directories are never created —
 * callers own their `mkdir`.
 */
export default async function writeIfAbsent(
	target: string,
	content: string,
): Promise<"created" | "exists"> {
	try {
		await writeFile(target, content, { encoding: "utf-8", flag: "wx" });
		return "created";
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "EEXIST") return "exists";
		throw error;
	}
}
