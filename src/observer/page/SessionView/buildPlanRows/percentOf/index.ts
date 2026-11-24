/** `part` of `total` as a whole percent for a progress bar; an empty total is 0. */
export default function percentOf({ part, total }: { part: number; total: number }): number {
	return total > 0 ? Math.round((100 * part) / total) : 0;
}
