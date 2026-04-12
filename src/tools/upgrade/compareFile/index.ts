import { readFile } from "node:fs/promises";
import type { UpgradeFileStatus } from "@/types/index.js";

/**
 * Compare a host file against canonical content.
 *
 * Read-only — never writes. Returns:
 * - `"missing"` when the file does not exist
 * - `"matches"` when the file content is byte-identical to canonical
 * - `"differs"` when the file exists but content differs
 *
 * Non-ENOENT read errors are re-thrown.
 */
export default async function compareFile(
	hostPath: string,
	canonicalContent: string,
): Promise<UpgradeFileStatus> {
	let existing: string;

	try {
		existing = await readFile(hostPath, "utf-8");
	} catch (err) {
		if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
			throw err;
		}
		return "missing";
	}

	return existing === canonicalContent ? "matches" : "differs";
}
