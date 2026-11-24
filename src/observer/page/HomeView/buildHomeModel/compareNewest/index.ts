/** Orders two ISO instants newest first, for `Array.sort`. */
export default function compareNewest(a: string, b: string): number {
	return a < b ? 1 : a > b ? -1 : 0;
}
