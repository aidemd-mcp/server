/** The parts that are set joined with ` · `, or null when none is (the line is left out then). Pure. */
export default function joinMeta(parts: (string | null | undefined)[]): string | null {
	const present = parts.filter((part): part is string => part !== null && part !== undefined && part !== "");
	return present.length === 0 ? null : present.join(" · ");
}
