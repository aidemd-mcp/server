import type { ObserverEvent } from "@/types/index.js";

/**
 * The events of the named sessions in one history order: each session keeps its own `seq` order,
 * and the sessions are merged by time (a tie goes to the lower session id). Nothing is added,
 * merged or dropped. This is the order the observer's own history uses.
 */
export default function orderEvents({ events, sessionIds }: { events: ObserverEvent[]; sessionIds: string[] }): ObserverEvent[] {
	const queues = sessionIds.map((sessionId) => ({
		sessionId,
		ordered: events.filter((event) => event.sessionId === sessionId).sort((a, b) => a.seq - b.seq),
		next: 0,
	}));

	const merged: ObserverEvent[] = [];
	for (;;) {
		let chosen: (typeof queues)[number] | null = null;
		for (const queue of queues) {
			const head = queue.ordered[queue.next];
			if (head === undefined) continue;
			const chosenHead = chosen?.ordered[chosen.next];
			if (chosen === null || chosenHead === undefined) {
				chosen = queue;
				continue;
			}
			const byTime = Date.parse(head.ts) - Date.parse(chosenHead.ts);
			if (byTime < 0 || (byTime === 0 && head.sessionId < chosenHead.sessionId)) chosen = queue;
		}
		if (chosen === null) return merged;
		merged.push(chosen.ordered[chosen.next]!);
		chosen.next += 1;
	}
}
