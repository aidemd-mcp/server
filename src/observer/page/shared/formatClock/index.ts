import { DAY_MS } from "@/util/timeUnits/index.js";
import pickDay from "./pickDay/index.js";

const pad = (value: number): string => String(value).padStart(2, "0");

const startOfDay = (date: Date): number => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();

/**
 * Formats an ISO instant in local time for the history and session rows: `clock` is `HH:MM`, `day`
 * is `Today`, `Yesterday`, a weekday for 2 to 6 days ago, else `Nov 21`-style (see `pickDay`)
 * relative to `now`; `start` is both joined.
 */
export default function formatClock({ iso, now }: { iso: string; now: Date }): {
	clock: string;
	day: string;
	start: string;
} {
	const at = new Date(iso);
	const clock = `${pad(at.getHours())}:${pad(at.getMinutes())}`;
	const daysAgo = Math.round((startOfDay(now) - startOfDay(at)) / DAY_MS);
	const day = pickDay({ at, daysAgo });
	return { clock, day, start: `${day} ${clock}` };
}
