import type { ObserverEvent, Phase } from "@/types/index.js";
import formatSpan from "@/observer/page/shared/formatSpan/index.js";

type PhaseEvent = Extract<ObserverEvent, { kind: "phase_started" | "phase_finished" }>;

/**
 * How long the module's latest run of a phase took: from the newest earlier `phase_started` of that
 * phase to its newest `phase_finished`, written the handoff's way (`6m 02s`). Null when either end
 * was never reported, so a cell then says only that the phase is done.
 */
export default function findPhaseDuration({ moduleEvents, phase }: { moduleEvents: ObserverEvent[]; phase: Phase }): string | null {
	const finished = moduleEvents
		.filter((event): event is PhaseEvent => event.kind === "phase_finished" && event.phase === phase)
		.at(-1);
	if (!finished) return null;
	const started = moduleEvents
		.filter((event): event is PhaseEvent => event.kind === "phase_started" && event.phase === phase && event.seq < finished.seq)
		.at(-1);
	if (!started) return null;
	return formatSpan((Date.parse(finished.ts) - Date.parse(started.ts)) / 1000);
}
