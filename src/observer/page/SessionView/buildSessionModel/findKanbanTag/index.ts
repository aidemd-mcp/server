import type { ObserverEvent } from "@/types/index.js";

/** The kanban tag the newest `session_started` event reported, if any session reported one. */
export default function findKanbanTag({ events }: { events: ObserverEvent[] }): string | undefined {
	let newest: Extract<ObserverEvent, { kind: "session_started" }> | null = null;
	for (const event of events) {
		if (event.kind === "session_started" && event.kanbanTag && (newest === null || event.ts > newest.ts)) newest = event;
	}
	return newest?.kanbanTag;
}
