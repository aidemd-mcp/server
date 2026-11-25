/** Keeps a size between its bounds; when the bounds cross (a window too small for the minimum), the minimum wins. Pure. */
export default function clampSize({ value, min, max }: { value: number; min: number; max: number }): number {
	return Math.round(Math.max(min, Math.min(value, max)));
}
