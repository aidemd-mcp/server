import { SECOND_MS, SECONDS_PER_DAY, SECONDS_PER_HOUR, SECONDS_PER_MINUTE } from "@/util/timeUnits/index.js";

const WEEK = 7 * SECONDS_PER_DAY;

/**
 * Formats how long ago a project's newest event was, for the Home project row: `now` under a
 * minute, `<n>m ago`, `<n>h ago`, `yesterday` for one day, `<n> days ago` for 2-6, then
 * `1 week ago` and `<n> weeks ago`. An instant after `now` reads as `now`.
 */
export default function formatLastActivity({ iso, now }: { iso: string; now: Date }): string {
	const seconds = Math.max(0, Math.floor((now.getTime() - new Date(iso).getTime()) / SECOND_MS));
	if (seconds < SECONDS_PER_MINUTE) return "now";
	if (seconds < SECONDS_PER_HOUR) return `${Math.floor(seconds / SECONDS_PER_MINUTE)}m ago`;
	if (seconds < SECONDS_PER_DAY) return `${Math.floor(seconds / SECONDS_PER_HOUR)}h ago`;
	if (seconds < 2 * SECONDS_PER_DAY) return "yesterday";
	if (seconds < WEEK) return `${Math.floor(seconds / SECONDS_PER_DAY)} days ago`;
	const weeks = Math.floor(seconds / WEEK);
	return weeks === 1 ? "1 week ago" : `${weeks} weeks ago`;
}
