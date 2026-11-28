/** Counts exact substring occurrences of `marker` in `readme`, so spliceSection can refuse a missing or doubled marker. */
export default function countMarker({ readme, marker }: { readme: string; marker: string }): number {
	return readme.split(marker).length - 1;
}
