import type { ObserverEvent } from "@/types/index.js";

const pad = (value: number): string => String(value).padStart(2, "0");

/** The local `HH:MM:SS` of the newest held event (later `ts` wins, then later `seq`), or null when none is held. */
export default function findLastUpdate({ events }: { events: ObserverEvent[] }): string | null {
	let newest: ObserverEvent | null = null;
	for (const event of events) {
		if (newest === null || event.ts > newest.ts || (event.ts === newest.ts && event.seq > newest.seq)) newest = event;
	}
	if (newest === null) return null;
	const at = new Date(newest.ts);
	return `${pad(at.getHours())}:${pad(at.getMinutes())}:${pad(at.getSeconds())}`;
}
