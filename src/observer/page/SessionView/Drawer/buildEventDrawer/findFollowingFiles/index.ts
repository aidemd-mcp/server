import type { ObserverEvent } from "@/types/index.js";

/**
 * The `file_written` events that follow an event in its session with no other event between: the
 * run the history folds under that event's row. Pure.
 */
export default function findFollowingFiles({
	event,
	events,
}: {
	event: ObserverEvent;
	events: ObserverEvent[];
}): Extract<ObserverEvent, { kind: "file_written" }>[] {
	const later = events.filter((other) => other.sessionId === event.sessionId && other.seq > event.seq).sort((a, b) => a.seq - b.seq);
	const run: Extract<ObserverEvent, { kind: "file_written" }>[] = [];
	for (const other of later) {
		if (other.kind !== "file_written") break;
		run.push(other);
	}
	return run;
}
