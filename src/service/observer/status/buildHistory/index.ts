import type { ObserverEvent } from "@/types/index.js";
import type { HistoryRow } from "../types/index.js";
import labelEvent from "./labelEvent/index.js";

/** `ts` of the latest earlier `phase_started` in the session's own order for the same phase and module. */
function findStartedAt({ ordered, index }: { ordered: ObserverEvent[]; index: number }): string | undefined {
	const finished = ordered[index];
	if (finished?.kind !== "phase_finished") return undefined;

	for (let i = index - 1; i >= 0; i--) {
		const candidate = ordered[i];
		if (candidate?.kind !== "phase_started") continue;
		if (candidate.phase === finished.phase && candidate.module === finished.module) return candidate.ts;
	}
	return undefined;
}

/**
 * Builds the history: exactly one row per recorded event. Each session keeps
 * its own `seq` order; sessions are merged by time. Never adds a row for a gap
 * in `seq` and never merges or drops an event.
 */
export default function buildHistory({ events }: { events: ObserverEvent[] }): HistoryRow[] {
	// Step 1: group by session, each group in its own seq order.
	const groups = new Map<string, ObserverEvent[]>();
	for (const event of events) {
		const group = groups.get(event.sessionId);
		if (group) group.push(event);
		else groups.set(event.sessionId, [event]);
	}
	const queues = [...groups.values()].map((group) => ({
		ordered: [...group].sort((a, b) => a.seq - b.seq),
		next: 0,
	}));

	// Step 2: merge the groups by repeatedly taking the head with the earliest ts (ties: sessionId ascending).
	const rows: HistoryRow[] = [];
	for (;;) {
		let chosen: (typeof queues)[number] | null = null;
		for (const queue of queues) {
			const head = queue.ordered[queue.next];
			if (!head) continue;
			const chosenHead = chosen?.ordered[chosen.next];
			if (!chosen || !chosenHead) {
				chosen = queue;
				continue;
			}
			const byTime = Date.parse(head.ts) - Date.parse(chosenHead.ts);
			if (byTime < 0 || (byTime === 0 && head.sessionId < chosenHead.sessionId)) chosen = queue;
		}
		if (!chosen) break;

		// Step 3: one row per event; a finished phase takes its duration from its own session's start.
		const index = chosen.next;
		const event = chosen.ordered[index]!;
		const startedAt = findStartedAt({ ordered: chosen.ordered, index });
		rows.push({
			sessionId: event.sessionId,
			seq: event.seq,
			ts: event.ts,
			kind: event.kind,
			...labelEvent({ event, startedAt }),
		});
		chosen.next += 1;
	}
	return rows;
}
