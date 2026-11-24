import { SECONDS_PER_HOUR, SECONDS_PER_MINUTE } from "@/util/timeUnits/index.js";

/** Seconds since midnight of an `HH:MM:SS` clock time. */
function toSeconds(clock: string): number {
	const [hours, minutes, seconds] = clock.split(":").map(Number);
	return hours * SECONDS_PER_HOUR + minutes * SECONDS_PER_MINUTE + seconds;
}

/**
 * Converts one of the design export's clock times into a fixture event offset (minutes before `now`):
 * the export's clock spacing is kept, anchored so that the `anchor` time sits `anchorAgoMin` minutes
 * ago. A time later than the anchor gives an offset below `anchorAgoMin`.
 */
export default function clockOffset({
	at,
	anchor,
	anchorAgoMin,
}: {
	at: string;
	anchor: string;
	anchorAgoMin: number;
}): number {
	return anchorAgoMin + (toSeconds(anchor) - toSeconds(at)) / SECONDS_PER_MINUTE;
}
