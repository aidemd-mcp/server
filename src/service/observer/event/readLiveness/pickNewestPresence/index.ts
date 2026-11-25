import type { Presence } from "@/service/observer/event/shared/presenceRecord/index.js";

/**
 * The presence with the newest `at`, or null for an empty list. Two Claude
 * sessions can link to one observer session (a `/clear` or `/resume` changes
 * the Claude id, brief commitment #92), and the newest hook call speaks for it.
 * A tie keeps the earlier entry.
 */
export default function pickNewestPresence({ presences }: { presences: Presence[] }): Presence | null {
	return presences.reduce<Presence | null>(
		(newest, candidate) => (newest === null || Date.parse(candidate.at) > Date.parse(newest.at) ? candidate : newest),
		null,
	);
}
