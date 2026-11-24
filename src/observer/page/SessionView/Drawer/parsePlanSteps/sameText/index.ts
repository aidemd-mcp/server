/** True when two plan texts read the same once case and runs of whitespace are ignored. Pure. */
export default function sameText(a: string, b: string): boolean {
	const normalise = (text: string) => text.replace(/\s+/g, " ").trim().toLowerCase();
	return normalise(a) === normalise(b);
}
