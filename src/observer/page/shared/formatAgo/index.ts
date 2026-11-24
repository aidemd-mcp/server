import { SECOND_MS, SECONDS_PER_HOUR, SECONDS_PER_MINUTE } from "@/util/timeUnits/index.js";
import formatSpan from "@/observer/page/shared/formatSpan/index.js";

/**
 * Formats how long ago an instant was, for "last event … ago" lines: `Ns` under a minute, `Nm` under
 * an hour (the seconds dropped), and `formatSpan`'s `Nh MMm` from an hour on. An instant after
 * `now` reads as zero seconds.
 */
export default function formatAgo({ iso, now }: { iso: string; now: Date }): string {
	const seconds = Math.max(0, Math.floor((now.getTime() - new Date(iso).getTime()) / SECOND_MS));
	if (seconds < SECONDS_PER_MINUTE) return formatSpan(seconds);
	if (seconds < SECONDS_PER_HOUR) return `${Math.floor(seconds / SECONDS_PER_MINUTE)}m`;
	return formatSpan(seconds);
}
