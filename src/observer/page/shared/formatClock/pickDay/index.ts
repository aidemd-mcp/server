const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/**
 * Names a calendar day relative to today: `Today`, `Yesterday`, a weekday (`Mon`…`Sun`) for 2 to 6
 * days ago, else month and date (`Nov 21`).
 */
export default function pickDay({ at, daysAgo }: { at: Date; daysAgo: number }): string {
	if (daysAgo === 0) return "Today";
	if (daysAgo === 1) return "Yesterday";
	if (daysAgo >= 2 && daysAgo <= 6) return WEEKDAYS[at.getDay()]!;
	return `${MONTHS[at.getMonth()]} ${at.getDate()}`;
}
