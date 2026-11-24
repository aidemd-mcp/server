/** Whether a `##` heading names the pinned section, "Where this cycle stopped" (case-insensitive prefix). */
export default function isStopHeading(heading: string): boolean {
	return heading.trim().toLowerCase().startsWith("where this cycle stopped");
}
