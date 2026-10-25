import { lstat } from "node:fs/promises";
import { join } from "node:path";
import type { InitStep } from "@/types/index.js";

const SESSION_INSTRUCTION =
	'Call aide_scaffold with directory "." and type "session" to create the empty session record at .aide/session.aide.';

/**
 * Return a planning step for the project's session record (`.aide/session.aide`).
 *
 * The install directs the agent to scaffold rather than writing the file itself:
 * aide_scaffold owns the one placeholder, so the install never carries a copy of
 * its bytes. The step is therefore content-free.
 *
 * - `would-create`: the record is absent; the step carries the scaffold instruction.
 * - `exists`: any entry is present. Filled or empty, an existing record is the
 *   user's, so its bytes are never read or compared and it can never become
 *   `would-overwrite`.
 *
 * Any fs error other than ENOENT propagates. This helper never writes to disk.
 */
export default async function planSessionRecord(projectRoot: string): Promise<InitStep> {
	const name = "Session record (session.aide)";
	const filePath = join(projectRoot, ".aide", "session.aide");

	try {
		await lstat(filePath);
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
		return { name, status: "would-create", category: "methodology", filePath, instructions: SESSION_INSTRUCTION };
	}

	return { name, status: "exists", category: "methodology", filePath };
}
