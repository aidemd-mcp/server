import { readFile } from "node:fs/promises";

/**
 * Compares the bytes of a file on disk against canonical content.
 *
 * Returns:
 * - `"would-create"` — file does not exist (ENOENT)
 * - `"would-skip"` — file exists and its bytes are identical to `canonicalBytes`
 * - `"would-overwrite"` — file exists and its bytes differ from `canonicalBytes`
 *
 * Non-ENOENT read errors (e.g. a directory at the path, permission denied)
 * propagate to the caller unchanged.
 */
export default async function compareBytes(
	filePath: string,
	canonicalBytes: string,
): Promise<"would-create" | "would-skip" | "would-overwrite"> {
	let diskBytes: string;

	try {
		diskBytes = await readFile(filePath, "utf-8");
	} catch (err) {
		if ((err as NodeJS.ErrnoException).code === "ENOENT") return "would-create";
		throw err;
	}

	return diskBytes === canonicalBytes ? "would-skip" : "would-overwrite";
}
