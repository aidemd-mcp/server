const pad = (value: number): string => String(value).padStart(2, "0");

/** The local clock time of an ISO instant as `HH:MM:SS`: when the observer last read the board. */
export default function formatLastTry({ iso }: { iso: string }): string {
	const at = new Date(iso);
	return `${pad(at.getHours())}:${pad(at.getMinutes())}:${pad(at.getSeconds())}`;
}
