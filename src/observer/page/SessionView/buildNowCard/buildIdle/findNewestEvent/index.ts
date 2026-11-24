import type { ObserverEvent } from "@/types/index.js";

/** The newest event by time (the later one in the list wins a tie), or null with no events. */
export default function findNewestEvent({ events }: { events: ObserverEvent[] }): ObserverEvent | null {
	return events.reduce<ObserverEvent | null>((best, event) => (best === null || event.ts >= best.ts ? event : best), null);
}
