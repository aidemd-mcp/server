import type { ObserverEvent } from "@/types/index.js";

/** The pipeline an event names, or undefined for an event that carries none. */
function pipelineOf(event: ObserverEvent): string | undefined {
	return "pipeline" in event ? event.pipeline : undefined;
}

/**
 * The events a pipeline's rail reads, oldest first (by `ts`, then `sessionId`, then `seq`): with a
 * pipeline, every held event that names it, whichever session recorded it; without one, the events of
 * the rail's own session that name none, so a v1 log or hand work still draws a rail. An event of
 * another pipeline is never in the result, so another pipeline's gate or verdict cannot fill a cell.
 */
export default function selectPipelineEvents({
	events,
	pipeline,
	sessionId,
}: {
	events: ObserverEvent[];
	pipeline: string | null;
	sessionId: string;
}): ObserverEvent[] {
	const picked =
		pipeline === null
			? events.filter((event) => event.sessionId === sessionId && pipelineOf(event) === undefined)
			: events.filter((event) => pipelineOf(event) === pipeline);
	return [...picked].sort((a, b) => {
		const byTime = Date.parse(a.ts) - Date.parse(b.ts);
		if (byTime !== 0) return byTime;
		if (a.sessionId !== b.sessionId) return a.sessionId < b.sessionId ? -1 : 1;
		return a.seq - b.seq;
	});
}
