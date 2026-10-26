import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { SKIP_DIRS } from "@/types/index.js";
import isCodeFile from "./isCodeFile/index.js";

const SKIPPED: readonly string[] = SKIP_DIRS;

/**
 * True when `dir`, or any folder below it, holds a code file: any file but AIDE files,
 * Markdown and dot-files. Folders in SKIP_DIRS and dot-folders are not walked, symbolic
 * links are not followed, and an unreadable folder counts as holding no code.
 */
export default async function holdsCode(dir: string): Promise<boolean> {
	let entries;
	try {
		entries = await readdir(dir, { withFileTypes: true });
	} catch {
		return false;
	}
	for (const entry of entries) {
		if (entry.isDirectory()) {
			if (SKIPPED.includes(entry.name) || entry.name.startsWith(".")) continue;
			if (await holdsCode(join(dir, entry.name))) return true;
		} else if (isCodeFile(entry.name)) {
			return true;
		}
	}
	return false;
}
