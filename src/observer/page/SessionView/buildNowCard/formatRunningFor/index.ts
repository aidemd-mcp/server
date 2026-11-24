import formatElapsed from "@/observer/page/shared/formatElapsed/index.js";

/**
 * How long a phase has run, as the card prints it. The status reports `elapsedMs` as of `asOf` (when
 * it was built), so the time since then is added and the card keeps counting between statuses.
 */
export default function formatRunningFor({ elapsedMs, asOf, now }: { elapsedMs: number; asOf: string; now: Date }): string {
	const since = Math.max(0, now.getTime() - Date.parse(asOf));
	return formatElapsed((elapsedMs + since) / 1000);
}
