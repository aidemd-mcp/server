import type { ObserverEvent } from "@/types/index.js";
import type { Phase } from "../../types/index.js";

/**
 * Judges one stage that is not running, from one pipeline's ordered events.
 * `skipped` (with the report's reason) only when the newest `phase_skipped` or
 * `phase_started` of the phase is a `phase_skipped`, never inferred from a gap.
 * `done` when a `phase_finished` of the phase exists, or when a `phase_started`
 * of it is followed later by a closing event (another phase's `phase_started`,
 * a `gate_resolved`, a `commit` or a `pipeline_finished`), so a missed finish
 * still reads done. Anything else is `pending`. Pure.
 */
export default function judgeStage({
	phase,
	pipelineEvents,
}: {
	phase: Phase;
	pipelineEvents: ObserverEvent[];
}): { state: "done" | "skipped" | "pending"; reason?: string } {
	// Step 1: a skip report is the newest word on the phase.
	for (let i = pipelineEvents.length - 1; i >= 0; i--) {
		const event = pipelineEvents[i];
		if (event.kind === "phase_skipped" && event.phase === phase) return { state: "skipped", reason: event.reason };
		if (event.kind === "phase_started" && event.phase === phase) break;
	}

	// Step 2: a finish report, or a start closed by a later boundary, means done.
	const finished = pipelineEvents.some((event) => event.kind === "phase_finished" && event.phase === phase);
	if (finished) return { state: "done" };

	const closed = pipelineEvents.some(
		(event, index) =>
			event.kind === "phase_started" &&
			event.phase === phase &&
			pipelineEvents.slice(index + 1).some((later) => closesPhase({ event: later, phase })),
	);
	return closed ? { state: "done" } : { state: "pending" };
}

/** True when the event ends a running `phase`: another phase starting, a gate resolving, a commit or the pipeline finishing. */
function closesPhase({ event, phase }: { event: ObserverEvent; phase: Phase }): boolean {
	switch (event.kind) {
		case "phase_started":
			return event.phase !== phase;
		case "gate_resolved":
		case "commit":
		case "pipeline_finished":
			return true;
		default:
			return false;
	}
}
