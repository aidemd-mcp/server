import { SECONDS_PER_HOUR, SECONDS_PER_MINUTE } from "@/util/timeUnits/index.js";

/**
 * Formats a number of seconds the way the handoff writes durations: `45s` under a minute,
 * `7m 55s` under an hour (seconds zero-padded, `6m 02s`), `1h 12m` from an hour on (minutes
 * zero-padded). Negative and fractional input is clamped and floored. The one tail `formatElapsed`
 * and `formatAgo` share.
 */
export default function formatSpan(seconds: number): string {
	const total = Math.max(0, Math.floor(seconds));
	const hours = Math.floor(total / SECONDS_PER_HOUR);
	const minutes = Math.floor((total % SECONDS_PER_HOUR) / SECONDS_PER_MINUTE);
	const rest = total % SECONDS_PER_MINUTE;
	if (hours > 0) return `${hours}h ${String(minutes).padStart(2, "0")}m`;
	if (minutes > 0) return `${minutes}m ${String(rest).padStart(2, "0")}s`;
	return `${rest}s`;
}
