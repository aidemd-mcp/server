import type { ObserverEvent } from "@/types/index.js";

type TaskEvent = Extract<ObserverEvent, { kind: "task" }>;

/** True when `candidate` was recorded before `event`: earlier in time, or earlier in the same session at the same instant. */
function isEarlier({ candidate, event }: { candidate: ObserverEvent; event: ObserverEvent }): boolean {
	if (candidate.ts !== event.ts) return candidate.ts < event.ts;
	return candidate.sessionId === event.sessionId && candidate.seq < event.seq;
}

/**
 * The column an earlier `task` event of the project reported for the same slug: the column the
 * task was in before this event. Null when no earlier event named one, so the row then shows only
 * where the task went.
 */
export default function findPreviousColumn({ event, events }: { event: TaskEvent; events: ObserverEvent[] }): string | null {
	let newest: TaskEvent | null = null;
	for (const candidate of events) {
		if (candidate.kind !== "task" || candidate.slug !== event.slug || candidate.column === undefined) continue;
		if (!isEarlier({ candidate, event })) continue;
		if (newest === null || isEarlier({ candidate: newest, event: candidate })) newest = candidate;
	}
	return newest?.column ?? null;
}
