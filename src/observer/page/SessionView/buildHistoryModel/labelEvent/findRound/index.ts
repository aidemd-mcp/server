import type { ObserverEvent } from "@/types/index.js";

/**
 * How many `qa_verdict` events the session recorded for the module up to `seq`, counting a
 * verdict at `seq` itself when `inclusive`. A QA verdict is round `n` when `n` verdicts exist up to
 * and including it; a Fix started after `n` verdicts is round `max(n, 1)`, as the observer counts it.
 */
export default function findRound({
	events,
	sessionId,
	seq,
	inclusive,
	sameModule,
}: {
	events: ObserverEvent[];
	sessionId: string;
	seq: number;
	inclusive: boolean;
	sameModule(module: string): boolean;
}): number {
	return events.filter(
		(event) =>
			event.kind === "qa_verdict" &&
			event.sessionId === sessionId &&
			(inclusive ? event.seq <= seq : event.seq < seq) &&
			sameModule(event.module),
	).length;
}
