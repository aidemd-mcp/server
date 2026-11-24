import { HOUR_MS, MINUTE_MS, SECOND_MS } from "@/util/timeUnits/index.js";

/**
 * Formats an elapsed time for a history row: seconds under a minute, minutes
 * and seconds under an hour, hours and minutes beyond. Whole units, floored;
 * a negative span (clock skew between events) reads as `0s`.
 */
export default function formatDuration(ms: number): string {
	if (ms < SECOND_MS) return "0s";
	if (ms < MINUTE_MS) return `${Math.floor(ms / SECOND_MS)}s`;
	if (ms < HOUR_MS) return `${Math.floor(ms / MINUTE_MS)}m ${Math.floor((ms % MINUTE_MS) / SECOND_MS)}s`;
	return `${Math.floor(ms / HOUR_MS)}h ${Math.floor((ms % HOUR_MS) / MINUTE_MS)}m`;
}
