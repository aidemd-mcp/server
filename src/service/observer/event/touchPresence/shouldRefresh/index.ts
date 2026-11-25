import type { Presence } from "@/service/observer/event/shared/presenceRecord/index.js";

/** How old the stored presence time may get before an unchanged call refreshes it (brief commitment #72). */
export const PRESENCE_REFRESH_MS = 30_000;

/**
 * Decide whether a merged presence record is worth writing and pinging for
 * (brief commitments #72, #75 as amended 2026-11-25). Pure. True when there is
 * no stored record, when the state, the link or the transcript path differs
 * from the stored one, or when the merged time is at least
 * `PRESENCE_REFRESH_MS` past the stored time. A changed `hookEvent` alone does
 * not count, and neither does a merge that kept a newer stored record with
 * nothing filled in, so a hook call that tells the page nothing new touches
 * neither the file nor the observer.
 */
export default function shouldRefresh({
	existing,
	merged,
}: {
	existing: Presence | null;
	merged: Presence;
}): boolean {
	if (existing === null) return true;
	if (merged.state !== existing.state) return true;
	if (merged.sessionId !== existing.sessionId) return true;
	if (merged.transcriptPath !== existing.transcriptPath) return true;
	return Date.parse(merged.at) - Date.parse(existing.at) >= PRESENCE_REFRESH_MS;
}
