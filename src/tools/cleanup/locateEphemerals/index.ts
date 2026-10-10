import { lstat } from "node:fs/promises";
import { join } from "node:path";
import type { CleanupEphemeral, CleanupRefusal } from "@/types/index.js";

type LocatedEphemerals =
	| { kind: "ok"; present: CleanupEphemeral[] }
	| { kind: "refused"; refusal: CleanupRefusal };

/** The only names cleanup ever touches, in removal order: plan.aide last so a partial removal stays re-runnable. */
const EPHEMERALS: CleanupEphemeral[] = ["brief.aide", "todo.aide", "plan.aide"];

/**
 * Finds which of the three removal targets exist in the module directory.
 * Checks the fixed whitelist by name with `lstat` and never lists the
 * directory, so no other file is ever inspected. A name that exists but is
 * not a regular file (directory, symlink) is refused rather than removed.
 */
export default async function locateEphemerals(dir: string): Promise<LocatedEphemerals> {
	const present: CleanupEphemeral[] = [];
	for (const name of EPHEMERALS) {
		// ENOENT means absent; any other fs error is unexpected and propagates.
		const stats = await lstat(join(dir, name)).catch((error: NodeJS.ErrnoException) => {
			if (error.code === "ENOENT") return null;
			throw error;
		});
		if (stats === null) continue;
		if (!stats.isFile()) return { kind: "refused", refusal: { kind: "not-a-file", file: name } };
		present.push(name);
	}
	return { kind: "ok", present };
}
