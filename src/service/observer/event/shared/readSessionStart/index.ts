const SESSION_START_PATTERN = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(\d{3})Z-/;

/**
 * The UTC creation time an observer session id carries (brief commitment #20),
 * as epoch milliseconds. Pure. Null when the id does not have the
 * `YYYYMMDDTHHmmssSSSZ-` prefix or when the date it spells does not exist.
 */
export default function readSessionStart({ sessionId }: { sessionId: string }): number | null {
	const match = SESSION_START_PATTERN.exec(sessionId);
	if (match === null) return null;

	const [year, month, day, hour, minute, second, millisecond] = match.slice(1).map(Number);
	const start = new Date(Date.UTC(year, month - 1, day, hour, minute, second, millisecond));
	const spelledBack =
		start.getUTCFullYear() === year &&
		start.getUTCMonth() === month - 1 &&
		start.getUTCDate() === day &&
		start.getUTCHours() === hour &&
		start.getUTCMinutes() === minute &&
		start.getUTCSeconds() === second;

	return spelledBack ? start.getTime() : null;
}
