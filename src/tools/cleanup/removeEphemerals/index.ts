import { unlink } from "node:fs/promises";
import { join } from "node:path";
import type { CleanupEphemeral } from "@/types/index.js";

type RemovalOutcome =
	| { kind: "removed"; files: CleanupEphemeral[] }
	| { kind: "incomplete"; removed: CleanupEphemeral[]; remaining: CleanupEphemeral[]; error: string };

/**
 * Unlinks each present ephemeral in the order given (already the removal
 * order: brief, todo, plan), one at a time. Stops at the first failure and
 * reports what is gone and what is left, so a partial removal is surfaced
 * rather than thrown. This is the one place cleanup catches errors. Only
 * names in `present` are touched, and only with `unlink`.
 */
export default async function removeEphemerals(
	dir: string,
	present: CleanupEphemeral[],
): Promise<RemovalOutcome> {
	const removed: CleanupEphemeral[] = [];
	for (const [index, name] of present.entries()) {
		try {
			await unlink(join(dir, name));
		} catch (error) {
			return {
				kind: "incomplete",
				removed,
				remaining: present.slice(index),
				error: error instanceof Error ? error.message : String(error),
			};
		}
		removed.push(name);
	}
	return { kind: "removed", files: present };
}
