import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import type { UpgradeStatus } from "@/types/index.js";

/**
 * Compare a host file against canonical content and optionally overwrite.
 *
 * - File missing + write=false → "would create"
 * - File missing + write=true → creates file, returns "created"
 * - File exists, content matches → "unchanged"
 * - File exists, content differs + write=false → "would update"
 * - File exists, content differs + write=true → overwrites, returns "updated"
 */
export default async function compareFile(
	hostPath: string,
	canonicalContent: string,
	write: boolean,
): Promise<UpgradeStatus> {
	let existing: string;

	try {
		existing = await readFile(hostPath, "utf-8");
	} catch (err) {
		if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
			throw err;
		}

		// File does not exist.
		if (!write) {
			return "would create";
		}

		await mkdir(dirname(hostPath), { recursive: true });
		await writeFile(hostPath, canonicalContent, "utf-8");
		return "created";
	}

	// File exists — compare content.
	if (existing === canonicalContent) {
		return "unchanged";
	}

	if (!write) {
		return "would update";
	}

	await writeFile(hostPath, canonicalContent, "utf-8");
	return "updated";
}
