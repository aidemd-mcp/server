import { readFile } from "node:fs/promises";

/**
 * Reads a file as UTF-8 text, or `null` when it does not exist. Only ENOENT
 * means "absent": any other failure (permissions, a directory in its place)
 * propagates, so the hooks planner never mistakes an unreadable file for a
 * missing one and plans a write over it.
 */
export default async function readOptional(path: string): Promise<string | null> {
	try {
		return await readFile(path, "utf-8");
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
		throw error;
	}
}
