import type { ObserverEvent } from "@/types/index.js";

/** The kinds of event that report where a session stands in its phases; a pipeline-less rail reads only these. */
const PHASE_KINDS: ReadonlySet<ObserverEvent["kind"]> = new Set([
	"phase_started",
	"phase_finished",
	"phase_skipped",
	"gate_waiting",
	"gate_resolved",
	"plan_step_checked",
	"qa_verdict",
	"pipeline_started",
	"pipeline_finished",
	"commit",
]);

/** The pipeline an event names, or undefined for an event that carries none. */
function pipelineOf(event: ObserverEvent): string | undefined {
	return "pipeline" in event ? event.pipeline : undefined;
}

/**
 * One pipeline's events across sessions, ordered by `ts`, then `sessionId`,
 * then `seq`. With a pipeline: every event that names it, from this session,
 * the other sessions and the archived ones, plus this session's own commits
 * (a commit names no pipeline but closes a phase of the session's pipeline).
 * Without one (`null`): this session's phase-related events that name no
 * pipeline, so a v1 log or hand work still draws a rail. Never mixes in an
 * event of another pipeline.
 */
export default function collectPipelineEvents({
	sessionEvents,
	otherEvents,
	pipeline,
}: {
	sessionEvents: ObserverEvent[];
	otherEvents: ObserverEvent[];
	pipeline: string | null;
}): ObserverEvent[] {
	// Step 1: pick the events in scope.
	const picked =
		pipeline === null
			? sessionEvents.filter((event) => PHASE_KINDS.has(event.kind) && pipelineOf(event) === undefined)
			: [
					...sessionEvents.filter((event) => pipelineOf(event) === pipeline || event.kind === "commit"),
					...otherEvents.filter((event) => pipelineOf(event) === pipeline),
				];

	// Step 2: order by ts, then sessionId, then seq.
	return picked.sort((a, b) => {
		const byTime = Date.parse(a.ts) - Date.parse(b.ts);
		if (byTime !== 0) return byTime;
		if (a.sessionId !== b.sessionId) return a.sessionId < b.sessionId ? -1 : 1;
		return a.seq - b.seq;
	});
}
