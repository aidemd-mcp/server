/**
 * The calm text an empty record section shows. `Open questions` has the handoff's own sentence;
 * every other heading reads the one text the handoff does not draw.
 */
export default function emptyText(heading: string): string {
	if (heading.toLowerCase().includes("open questions")) return "No open questions recorded for this cycle.";
	return "Nothing recorded for this cycle yet.";
}
